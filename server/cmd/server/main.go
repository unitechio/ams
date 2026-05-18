// main.go is the composition root — wires all dependencies together.
// No business logic lives here; only dependency injection and runtime setup.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/owner/auth-server/internal/config"
	delivery "github.com/owner/auth-server/internal/delivery/http"
	"github.com/owner/auth-server/internal/infrastructure/persistence"
	jwtpkg "github.com/owner/auth-server/internal/jwt"
	"github.com/owner/auth-server/internal/usecase"
	webassets "github.com/owner/auth-server/web"
)

var (
	version = "dev"
	commit  = "local"
	date    = "unknown"
)

func main() {
	cfg := config.Load()
	setTimezone(cfg.Server.Timezone)
	logger := buildLogger(cfg.Server.Env)

	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		runHealthcheck(cfg, logger)
		return
	}

	logger.Info("starting auth server",
		slog.String("env", cfg.Server.Env),
		slog.String("host", cfg.Server.Host),
		slog.String("port", cfg.Server.Port),
		slog.String("version", version),
		slog.String("commit", commit),
		slog.String("build_date", date),
	)

	db := persistence.Connect(cfg.Database)
	persistence.Migrate(db)

	userRepo := persistence.NewGormUserRepository(db)
	roleRepo := persistence.NewGormRoleRepository(db)
	permRepo := persistence.NewGormPermissionRepository(db)
	menuRepo := persistence.NewGormMenuRepository(db)
	tokenRepo := persistence.NewGormTokenRepository(db)
	clientRepo := persistence.NewGormClientRepository(db)
	ssoProviderRepo := persistence.NewGormSSOProviderRepository(db)
	loginChannelRepo := persistence.NewGormLoginChannelRepository(db)
	securityPolicyRepo := persistence.NewGormSecurityPolicyRepository(db)
	referenceOptionRepo := persistence.NewGormReferenceOptionRepository(db)
	auditRepo := persistence.NewGormAuditLogRepository(db)
	authHistRepo := persistence.NewGormAuthHistoryRepository(db)

	permRepo.SyncFromRegistry()
	persistence.SyncMenus(db)
	persistence.SyncAuthClients(db)
	persistence.SyncLoginChannels(db)
	persistence.SyncSecurityPolicies(db)
	persistence.SyncReferenceOptions(db)
	persistence.Seed(db, permRepo)

	jwtSvc := jwtpkg.NewService(
		cfg.JWT.Secret,
		cfg.JWT.AccessTokenTTL,
		cfg.JWT.RefreshTokenTTL,
	)
	permLoader := persistence.NewPermLoader(db)

	authUC := usecase.NewAuthUsecase(userRepo, tokenRepo, clientRepo, loginChannelRepo, securityPolicyRepo, permRepo, authHistRepo, jwtSvc, ssoProviderRepo)
	userUC := usecase.NewUserUsecase(userRepo, tokenRepo, securityPolicyRepo)
	clientUC := usecase.NewClientUsecase(clientRepo, loginChannelRepo)
	ssoProviderUC := usecase.NewSSOProviderUsecase(ssoProviderRepo)
	loginChannelUC := usecase.NewLoginChannelUsecase(loginChannelRepo)
	securityPolicyUC := usecase.NewSecurityPolicyUsecase(securityPolicyRepo)
	referenceOptionUC := usecase.NewReferenceOptionUsecase(referenceOptionRepo)
	roleUC := usecase.NewRoleUsecase(roleRepo)
	permUC := usecase.NewPermissionUsecase(permRepo)
	menuUC := usecase.NewMenuUsecase(menuRepo)
	logUC := usecase.NewLogUsecase(auditRepo, authHistRepo)

	authHandler := delivery.NewAuthHandler(authUC)
	userHandler := delivery.NewUserHandler(userUC)
	clientHandler := delivery.NewClientHandler(clientUC)
	ssoProviderHandler := delivery.NewSSOProviderHandler(ssoProviderUC)
	loginChannelHandler := delivery.NewLoginChannelHandler(loginChannelUC)
	securityPolicyHandler := delivery.NewSecurityPolicyHandler(securityPolicyUC)
	referenceOptionHandler := delivery.NewReferenceOptionHandler(referenceOptionUC)
	roleHandler := delivery.NewRoleHandler(roleUC)
	permHandler := delivery.NewPermissionHandler(permUC)
	menuHandler := delivery.NewMenuHandler(menuUC)
	logHandler := delivery.NewLogHandler(logUC)

	engine := delivery.Setup(
		jwtSvc,
		permLoader,
		auditRepo,
		securityPolicyRepo,
		authHandler,
		userHandler,
		clientHandler,
		ssoProviderHandler,
		loginChannelHandler,
		securityPolicyHandler,
		referenceOptionHandler,
		roleHandler,
		permHandler,
		menuHandler,
		logHandler,
		cfg.Server.AllowOrigins,
		logger,
		cfg.Server.EnableSecurityHead,
		cfg.Server.ContentSecurity,
	)

	sqlDB, err := db.DB()
	if err != nil {
		logger.Error("failed to access sql db", slog.Any("error", err))
		os.Exit(1)
	}

	delivery.AttachOperationalRoutes(engine, delivery.OperationalOptions{
		Version:         version,
		Environment:     cfg.Server.Env,
		EnableMetrics:   cfg.Server.EnableMetrics,
		EnablePprof:     cfg.Server.EnablePprof,
		EnableSecurity:  cfg.Server.EnableSecurityHead,
		ContentSecurity: cfg.Server.ContentSecurity,
		Logger:          logger,
		ReadinessChecker: delivery.ReadinessChain(
			delivery.NamedCheck("postgres", func() error {
				ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
				defer cancel()
				return sqlDB.PingContext(ctx)
			}),
			delivery.NamedCheck("redis", redisDialCheck(cfg.Redis.Addr)),
		),
	})
	delivery.AttachSPA(engine, webassets.FS())

	addr := net.JoinHostPort(cfg.Server.Host, cfg.Server.Port)
	srv := &http.Server{
		Addr:              addr,
		Handler:           engine,
		ReadHeaderTimeout: cfg.Server.ReadHeaderTimeout,
		ReadTimeout:       cfg.Server.ReadTimeout,
		WriteTimeout:      cfg.Server.WriteTimeout,
		IdleTimeout:       cfg.Server.IdleTimeout,
	}

	errCh := make(chan error, 1)
	go func() {
		logger.Info("http server listening", slog.String("addr", addr))
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	stopCh := make(chan os.Signal, 1)
	signal.Notify(stopCh, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-errCh:
		logger.Error("http server failed", slog.Any("error", err))
		os.Exit(1)
	case sig := <-stopCh:
		logger.Info("shutdown signal received", slog.String("signal", sig.String()))
	}

	ctx, cancel := context.WithTimeout(context.Background(), cfg.Server.ShutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.Error("graceful shutdown failed", slog.Any("error", err))
		if closeErr := srv.Close(); closeErr != nil {
			logger.Error("forced close failed", slog.Any("error", closeErr))
		}
		os.Exit(1)
	}
	logger.Info("server stopped cleanly")
}

func buildLogger(env string) *slog.Logger {
	opts := &slog.HandlerOptions{Level: slog.LevelInfo}
	if env == "production" || env == "staging" {
		return slog.New(slog.NewJSONHandler(os.Stdout, opts))
	}
	return slog.New(slog.NewTextHandler(os.Stdout, opts))
}

func setTimezone(name string) {
	if name == "" {
		return
	}
	loc, err := time.LoadLocation(name)
	if err != nil {
		return
	}
	time.Local = loc
}

func runHealthcheck(cfg *config.Config, logger *slog.Logger) {
	url := fmt.Sprintf("http://127.0.0.1:%s/readyz", cfg.Server.Port)
	client := &http.Client{Timeout: 3 * time.Second}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		logger.Error("healthcheck request build failed", slog.Any("error", err))
		os.Exit(1)
	}
	resp, err := client.Do(req)
	if err != nil {
		logger.Error("healthcheck failed", slog.Any("error", err))
		os.Exit(1)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		logger.Error("healthcheck returned non-200", slog.Int("status", resp.StatusCode))
		os.Exit(1)
	}
}

func redisDialCheck(addr string) func() error {
	return func() error {
		if addr == "" {
			return nil
		}
		conn, err := net.DialTimeout("tcp", addr, 2*time.Second)
		if err != nil {
			return err
		}
		_ = conn.Close()
		return nil
	}
}

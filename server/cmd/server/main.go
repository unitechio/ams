// main.go is the composition root — wires all dependencies together.
// No business logic lives here; only dependency injection.
package main

import (
	"fmt"
	"log"

	"github.com/owner/auth-server/internal/config"
	delivery "github.com/owner/auth-server/internal/delivery/http"
	"github.com/owner/auth-server/internal/infrastructure/persistence"
	jwtpkg "github.com/owner/auth-server/internal/jwt"
	"github.com/owner/auth-server/internal/usecase"
)

func main() {
	// ── Config ────────────────────────────────────────────────────────────────
	cfg := config.Load()
	log.Printf("🚀 Starting Auth Server [%s] on :%s", cfg.Server.Env, cfg.Server.Port)

	// ── Infrastructure ────────────────────────────────────────────────────────
	db := persistence.Connect(cfg.Database.DSN)
	persistence.Migrate(db)

	// ── Repositories ──────────────────────────────────────────────────────────
	userRepo := persistence.NewGormUserRepository(db)
	roleRepo := persistence.NewGormRoleRepository(db)
	permRepo := persistence.NewGormPermissionRepository(db)
	menuRepo := persistence.NewGormMenuRepository(db)
	tokenRepo := persistence.NewGormTokenRepository(db)
	clientRepo := persistence.NewGormClientRepository(db)
	ssoProviderRepo := persistence.NewGormSSOProviderRepository(db)
	loginChannelRepo := persistence.NewGormLoginChannelRepository(db)
	securityPolicyRepo := persistence.NewGormSecurityPolicyRepository(db)
	auditRepo := persistence.NewGormAuditLogRepository(db)
	authHistRepo := persistence.NewGormAuthHistoryRepository(db)

	// ── Sync permission constants → DB (idempotent on every start) ───────────
	permRepo.SyncFromRegistry()
	persistence.SyncMenus(db)
	persistence.SyncSecurityPolicies(db)

	// ── Seed initial data (only if DB is empty) ───────────────────────────────
	persistence.Seed(db, permRepo)

	// ── JWT service ───────────────────────────────────────────────────────────
	jwtSvc := jwtpkg.NewService(
		cfg.JWT.Secret,
		cfg.JWT.AccessTokenTTL,
		cfg.JWT.RefreshTokenTTL,
	)

	// ── Permission Loader (middleware dependency) ─────────────────────────────
	// Loads FRESH permissions from DB on every authenticated request.
	// NEVER trusts stale permissions embedded in JWT.
	permLoader := persistence.NewPermLoader(db)

	// ── Usecases ──────────────────────────────────────────────────────────────
	authUC := usecase.NewAuthUsecase(userRepo, tokenRepo, clientRepo, loginChannelRepo, securityPolicyRepo, permRepo, authHistRepo, jwtSvc, ssoProviderRepo)
	userUC := usecase.NewUserUsecase(userRepo, tokenRepo, securityPolicyRepo)
	clientUC := usecase.NewClientUsecase(clientRepo, loginChannelRepo)
	ssoProviderUC := usecase.NewSSOProviderUsecase(ssoProviderRepo)
	loginChannelUC := usecase.NewLoginChannelUsecase(loginChannelRepo)
	securityPolicyUC := usecase.NewSecurityPolicyUsecase(securityPolicyRepo)
	roleUC := usecase.NewRoleUsecase(roleRepo)
	permUC := usecase.NewPermissionUsecase(permRepo)
	menuUC := usecase.NewMenuUsecase(menuRepo)
	logUC := usecase.NewLogUsecase(auditRepo, authHistRepo)

	// ── HTTP Handlers ─────────────────────────────────────────────────────────
	authHandler := delivery.NewAuthHandler(authUC)
	userHandler := delivery.NewUserHandler(userUC)
	clientHandler := delivery.NewClientHandler(clientUC)
	ssoProviderHandler := delivery.NewSSOProviderHandler(ssoProviderUC)
	loginChannelHandler := delivery.NewLoginChannelHandler(loginChannelUC)
	securityPolicyHandler := delivery.NewSecurityPolicyHandler(securityPolicyUC)
	roleHandler := delivery.NewRoleHandler(roleUC)
	permHandler := delivery.NewPermissionHandler(permUC)
	menuHandler := delivery.NewMenuHandler(menuUC)
	logHandler := delivery.NewLogHandler(logUC)

	// ── Router ────────────────────────────────────────────────────────────────
	engine := delivery.Setup(
		jwtSvc,
		permLoader,
		auditRepo,
		authHandler,
		userHandler,
		clientHandler,
		ssoProviderHandler,
		loginChannelHandler,
		securityPolicyHandler,
		roleHandler,
		permHandler,
		menuHandler,
		logHandler,
	)

	// ── Start server ──────────────────────────────────────────────────────────
	addr := fmt.Sprintf(":%s", cfg.Server.Port)
	log.Printf("✅ Server listening on %s", addr)
	if err := engine.Run(addr); err != nil {
		log.Fatalf("❌ Server failed: %v", err)
	}
}

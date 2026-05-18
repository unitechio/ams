package http

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/pprof"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type OperationalOptions struct {
	Version          string
	Environment      string
	EnableMetrics    bool
	EnablePprof      bool
	EnableSecurity   bool
	ContentSecurity  string
	ReadinessChecker func() error
	Logger           *slog.Logger
}

func DefaultMiddlewares(logger *slog.Logger, enableSecurity bool, csp string) []gin.HandlerFunc {
	handlers := []gin.HandlerFunc{
		requestIDMiddleware(),
		structuredLoggerMiddleware(logger),
		gin.Recovery(),
	}
	if enableSecurity {
		handlers = append(handlers, securityHeadersMiddleware(csp))
	}
	return handlers
}

func AttachOperationalRoutes(r *gin.Engine, opts OperationalOptions) {
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":      "ok",
			"version":     opts.Version,
			"environment": opts.Environment,
			"time":        time.Now().UTC().Format(time.RFC3339),
		})
	})

	r.GET("/readyz", func(c *gin.Context) {
		if opts.ReadinessChecker != nil {
			if err := opts.ReadinessChecker(); err != nil {
				c.JSON(http.StatusServiceUnavailable, gin.H{
					"status": "degraded",
					"error":  err.Error(),
				})
				return
			}
		}
		c.JSON(http.StatusOK, gin.H{
			"status":      "ready",
			"version":     opts.Version,
			"environment": opts.Environment,
		})
	})

	if opts.EnableMetrics {
		r.GET("/metrics", gin.WrapH(promhttp.Handler()))
	}
	if opts.EnablePprof {
		registerPprof(r)
	}
}

func requestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = newRequestID()
		}
		c.Set("request_id", requestID)
		c.Writer.Header().Set("X-Request-ID", requestID)
		c.Next()
	}
}

func structuredLoggerMiddleware(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		requestID, _ := c.Get("request_id")
		path := c.FullPath()
		if path == "" {
			path = c.Request.URL.Path
		}
		level := slog.LevelInfo
		if c.Writer.Status() >= http.StatusInternalServerError {
			level = slog.LevelError
		} else if c.Writer.Status() >= http.StatusBadRequest {
			level = slog.LevelWarn
		}
		logger.LogAttrs(
			c.Request.Context(),
			level,
			"http_request",
			slog.String("request_id", stringify(requestID)),
			slog.String("method", c.Request.Method),
			slog.String("path", path),
			slog.String("query", c.Request.URL.RawQuery),
			slog.Int("status", c.Writer.Status()),
			slog.Duration("latency", time.Since(start)),
			slog.String("client_ip", c.ClientIP()),
			slog.String("user_agent", c.Request.UserAgent()),
			slog.Int("bytes_written", c.Writer.Size()),
			slog.Int("errors", len(c.Errors)),
		)
	}
}

func securityHeadersMiddleware(csp string) gin.HandlerFunc {
	return func(c *gin.Context) {
		headers := c.Writer.Header()
		headers.Set("X-Content-Type-Options", "nosniff")
		headers.Set("X-Frame-Options", "DENY")
		headers.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		headers.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		headers.Set("Cross-Origin-Opener-Policy", "same-origin")
		headers.Set("Cross-Origin-Resource-Policy", "same-origin")
		headers.Set("Content-Security-Policy", strings.TrimSpace(csp))
		if c.Request.TLS != nil {
			headers.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
		}
		c.Next()
	}
}

func registerPprof(r *gin.Engine) {
	group := r.Group("/debug/pprof")
	group.GET("/", gin.WrapF(pprof.Index))
	group.GET("/cmdline", gin.WrapF(pprof.Cmdline))
	group.GET("/profile", gin.WrapF(pprof.Profile))
	group.POST("/symbol", gin.WrapF(pprof.Symbol))
	group.GET("/symbol", gin.WrapF(pprof.Symbol))
	group.GET("/trace", gin.WrapF(pprof.Trace))
	group.GET("/allocs", gin.WrapH(pprof.Handler("allocs")))
	group.GET("/block", gin.WrapH(pprof.Handler("block")))
	group.GET("/goroutine", gin.WrapH(pprof.Handler("goroutine")))
	group.GET("/heap", gin.WrapH(pprof.Handler("heap")))
	group.GET("/mutex", gin.WrapH(pprof.Handler("mutex")))
	group.GET("/threadcreate", gin.WrapH(pprof.Handler("threadcreate")))
}

func newRequestID() string {
	var buf [16]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return time.Now().UTC().Format("20060102150405.000000000")
	}
	return hex.EncodeToString(buf[:])
}

func stringify(value any) string {
	switch v := value.(type) {
	case string:
		return v
	case nil:
		return ""
	default:
		return strings.TrimSpace(fmt.Sprint(v))
	}
}

func ReadinessChain(checks ...func() error) func() error {
	return func() error {
		for _, check := range checks {
			if check == nil {
				continue
			}
			if err := check(); err != nil {
				return err
			}
		}
		return nil
	}
}

func NamedCheck(name string, fn func() error) func() error {
	return func() error {
		if fn == nil {
			return nil
		}
		if err := fn(); err != nil {
			return errors.New(name + ": " + err.Error())
		}
		return nil
	}
}

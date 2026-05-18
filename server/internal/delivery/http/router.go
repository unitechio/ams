package http

import (
	"log/slog"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/owner/auth-server/internal/authorization/permission"
	jwtpkg "github.com/owner/auth-server/internal/jwt"
	"github.com/owner/auth-server/internal/middleware"
)

// Setup builds the Gin engine with all routes and middleware.
//
// Authorization strategy:
//   - Authenticate middleware validates JWT → loads permissions from DB → injects into context
//   - RequirePermission middleware enforces permission check per route
//   - InjectScope middleware sets data scope for handlers that do data filtering
//   - Handlers NEVER check roles — only middleware does authorization
func Setup(
	jwtSvc *jwtpkg.Service,
	permLoader middleware.PermissionLoader,
	auditLogger middleware.AuditLogger,
	stepUpPolicyRepo middleware.StepUpPolicyRepository,
	authH *AuthHandler,
	userH *UserHandler,
	clientH *ClientHandler,
	ssoProviderH *SSOProviderHandler,
	loginChannelH *LoginChannelHandler,
	securityPolicyH *SecurityPolicyHandler,
	referenceOptionH *ReferenceOptionHandler,
	roleH *RoleHandler,
	permH *PermissionHandler,
	menuH *MenuHandler,
	logH *LogHandler,
	allowOrigins []string,
	logger *slog.Logger,
	enableSecurityHeaders bool,
	contentSecurityPolicy string,
) *gin.Engine {
	r := gin.New()
	for _, mw := range DefaultMiddlewares(logger, enableSecurityHeaders, contentSecurityPolicy) {
		r.Use(mw)
	}
	r.SetTrustedProxies(nil)

	// ── CORS ──────────────────────────────────────────────────────────────────
	r.Use(cors.New(cors.Config{
		AllowOrigins:     allowOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Step-Up-Token", "X-Request-ID"},
		ExposeHeaders:    []string{"Content-Length", "X-Request-ID"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	api := r.Group("/api/v1")

	// ── Public routes (no auth required) ─────────────────────────────────────
	public := api.Group("/auth")
	{
		public.POST("/login", authH.Login)
		public.POST("/authorize", authH.Authorize)
		public.POST("/token", authH.Token)
		public.POST("/refresh", authH.Refresh)
		public.POST("/forgot-password", authH.ForgotPassword)
		public.POST("/reset-password", authH.ResetPasswordWithToken)
		public.POST("/verify-email", authH.VerifyEmail)
		public.GET("/sso/providers", authH.SSOProviders)
		public.GET("/sso/:provider/start", authH.StartSSO)
		public.POST("/sso/:provider/complete", authH.CompleteSSO)
	}

	// ── Authenticated routes (JWT required) ───────────────────────────────────
	// All routes below require a valid Bearer token.
	// Authenticate loads FRESH permissions from DB — never trusts JWT claims.
	auth := api.Group("")
	auth.Use(middleware.Authenticate(jwtSvc, permLoader))
	auth.Use(middleware.Audit(auditLogger))
	{
		// Auth self-service (any authenticated user)
		authGrp := auth.Group("/auth")
		{
			authGrp.POST("/logout", authH.Logout)
			authGrp.GET("/me", authH.Me)
			authGrp.PUT("/change-password", authH.ChangePassword)
			authGrp.POST("/send-verification-email", authH.SendVerificationEmail)
			authGrp.POST("/step-up", authH.StepUp)

			// Session Management
			authGrp.GET("/sessions", authH.Sessions)
			authGrp.DELETE("/sessions/:id", middleware.RequirePolicyStepUp(jwtSvc, stepUpPolicyRepo, "session.revoke", true), authH.RevokeSession)
			authGrp.DELETE("/sessions", middleware.RequirePolicyStepUp(jwtSvc, stepUpPolicyRepo, "session.revoke", true), authH.RevokeAllSessions)

			// 2FA Management
			authGrp.POST("/2fa/setup", authH.Setup2FA)
			authGrp.POST("/2fa/verify", authH.Verify2FA)
			authGrp.POST("/2fa/disable", middleware.RequirePolicyStepUp(jwtSvc, stepUpPolicyRepo, "2fa.disable", true), authH.Disable2FA)
		}

		// Permission-filtered menu for current user (used by sidebar)
		// No permission check needed — filter is applied server-side by permission set
		auth.GET("/my-menus", menuH.MyMenus)

		// ── Users — requires user.read permission ────────────────────────────
		users := auth.Group("/users")
		users.Use(
			middleware.RequirePermission(permission.PermissionUserRead),
			middleware.InjectScope(permission.PermissionUserRead),
		)
		{
			users.GET("", userH.List)
			users.GET("/:id", userH.Get)
			users.POST("",
				middleware.RequirePermission(permission.PermissionUserCreate),
				userH.Create,
			)
			users.PUT("/:id",
				middleware.RequirePermission(permission.PermissionUserUpdate),
				userH.Update,
			)
			users.DELETE("/:id",
				middleware.RequirePermission(permission.PermissionUserDelete),
				middleware.RequireStepUp(jwtSvc),
				userH.Delete,
			)
			users.POST("/:id/reset-password",
				middleware.RequirePermission(permission.PermissionUserUpdate),
				middleware.RequirePolicyStepUp(jwtSvc, stepUpPolicyRepo, "user.reset_password", true),
				userH.ResetPassword,
			)
		}

		// ── Roles — requires role.read permission ────────────────────────────
		roles := auth.Group("/roles")
		roles.Use(middleware.RequirePermission(permission.PermissionRoleRead))
		{
			roles.GET("", roleH.List)
			roles.GET("/:id", roleH.Get)
			roles.POST("",
				middleware.RequirePermission(permission.PermissionRoleCreate),
				roleH.Create,
			)
			roles.PUT("/:id",
				middleware.RequirePermission(permission.PermissionRoleUpdate),
				roleH.Update,
			)
			roles.DELETE("/:id",
				middleware.RequirePermission(permission.PermissionRoleDelete),
				roleH.Delete,
			)
			// Assign permissions to role requires role.assign
			roles.PUT("/:id/permissions",
				middleware.RequirePermission(permission.PermissionRoleAssign),
				middleware.RequirePolicyStepUp(jwtSvc, stepUpPolicyRepo, "role.assign_permissions", true),
				roleH.AssignPermissions,
			)
		}

		// ── Permissions — requires permission.read ───────────────────────────
		perms := auth.Group("/permissions")
		perms.Use(middleware.RequirePermission(permission.PermissionPermRead))
		{
			perms.GET("", permH.ListAll)
			perms.POST("",
				middleware.RequirePermission(permission.PermissionPermCreate),
				permH.Create,
			)
			perms.POST("/:code/lines",
				middleware.RequirePermission(permission.PermissionPermUpdate),
				permH.AddLine,
			)
			perms.DELETE("/:code/lines/:lineID",
				middleware.RequirePermission(permission.PermissionPermUpdate),
				permH.DeleteLine,
			)
		}

		// ── Menus — requires menu.read ───────────────────────────────────────
		menus := auth.Group("/menus")
		menus.Use(middleware.RequirePermission(permission.PermissionMenuRead))
		{
			menus.GET("", menuH.List)
			menus.POST("",
				middleware.RequirePermission(permission.PermissionMenuCreate),
				menuH.Create,
			)
			menus.PUT("/:id",
				middleware.RequirePermission(permission.PermissionMenuUpdate),
				menuH.Update,
			)
			menus.DELETE("/:id",
				middleware.RequirePermission(permission.PermissionMenuDelete),
				menuH.Delete,
			)
		}

		clients := auth.Group("/auth-clients")
		clients.Use(middleware.RequirePermission(permission.PermissionClientRead))
		{
			clients.GET("", clientH.List)
			clients.GET("/:id", clientH.Get)
			clients.POST("",
				middleware.RequirePermission(permission.PermissionClientCreate),
				middleware.RequireStepUp(jwtSvc),
				clientH.Create,
			)
			clients.PUT("/:id",
				middleware.RequirePermission(permission.PermissionClientUpdate),
				middleware.RequireStepUp(jwtSvc),
				clientH.Update,
			)
			clients.POST("/:id/rotate-secret",
				middleware.RequirePermission(permission.PermissionClientUpdate),
				middleware.RequirePolicyStepUp(jwtSvc, stepUpPolicyRepo, "client.rotate_secret", true),
				clientH.RotateSecret,
			)
			clients.DELETE("/:id",
				middleware.RequirePermission(permission.PermissionClientDelete),
				middleware.RequirePolicyStepUp(jwtSvc, stepUpPolicyRepo, "client.delete", true),
				clientH.Delete,
			)
		}

		serviceAccounts := auth.Group("/service-accounts")
		serviceAccounts.Use(middleware.RequirePermission(permission.PermissionServiceRead))
		{
			serviceAccounts.GET("", clientH.List)
			serviceAccounts.GET("/:id", clientH.Get)
			serviceAccounts.POST("",
				middleware.RequirePermission(permission.PermissionServiceCreate),
				middleware.RequireStepUp(jwtSvc),
				clientH.Create,
			)
			serviceAccounts.PUT("/:id",
				middleware.RequirePermission(permission.PermissionServiceUpdate),
				middleware.RequireStepUp(jwtSvc),
				clientH.Update,
			)
			serviceAccounts.POST("/:id/rotate-secret",
				middleware.RequirePermission(permission.PermissionServiceUpdate),
				middleware.RequirePolicyStepUp(jwtSvc, stepUpPolicyRepo, "client.rotate_secret", true),
				clientH.RotateSecret,
			)
			serviceAccounts.DELETE("/:id",
				middleware.RequirePermission(permission.PermissionServiceDelete),
				middleware.RequirePolicyStepUp(jwtSvc, stepUpPolicyRepo, "client.delete", true),
				clientH.Delete,
			)
		}

		ssoProviders := auth.Group("/sso-providers")
		ssoProviders.Use(middleware.RequirePermission(permission.PermissionClientRead))
		{
			ssoProviders.GET("", ssoProviderH.List)
			ssoProviders.GET("/:id", ssoProviderH.Get)
			ssoProviders.POST("",
				middleware.RequirePermission(permission.PermissionClientCreate),
				middleware.RequireStepUp(jwtSvc),
				ssoProviderH.Create,
			)
			ssoProviders.PUT("/:id",
				middleware.RequirePermission(permission.PermissionClientUpdate),
				middleware.RequireStepUp(jwtSvc),
				ssoProviderH.Update,
			)
			ssoProviders.DELETE("/:id",
				middleware.RequirePermission(permission.PermissionClientDelete),
				middleware.RequireStepUp(jwtSvc),
				ssoProviderH.Delete,
			)
		}

		loginChannels := auth.Group("/login-channels")
		loginChannels.Use(middleware.RequirePermission(permission.PermissionChannelRead))
		{
			loginChannels.GET("", loginChannelH.List)
			loginChannels.GET("/:id", loginChannelH.Get)
			loginChannels.POST("",
				middleware.RequirePermission(permission.PermissionChannelCreate),
				middleware.RequireStepUp(jwtSvc),
				loginChannelH.Create,
			)
			loginChannels.PUT("/:id",
				middleware.RequirePermission(permission.PermissionChannelUpdate),
				middleware.RequireStepUp(jwtSvc),
				loginChannelH.Update,
			)
			loginChannels.DELETE("/:id",
				middleware.RequirePermission(permission.PermissionChannelDelete),
				middleware.RequireStepUp(jwtSvc),
				loginChannelH.Delete,
			)
		}

		securityPolicies := auth.Group("/security-policies")
		securityPolicies.Use(middleware.RequirePermission(permission.PermissionPolicyRead))
		{
			securityPolicies.GET("", securityPolicyH.List)
			securityPolicies.GET("/:id", securityPolicyH.Get)
			securityPolicies.POST("",
				middleware.RequirePermission(permission.PermissionPolicyCreate),
				middleware.RequireStepUp(jwtSvc),
				securityPolicyH.Create,
			)
			securityPolicies.PUT("/:id",
				middleware.RequirePermission(permission.PermissionPolicyUpdate),
				middleware.RequirePolicyStepUp(jwtSvc, stepUpPolicyRepo, "policy.update", true),
				securityPolicyH.Update,
			)
			securityPolicies.DELETE("/:id",
				middleware.RequirePermission(permission.PermissionPolicyDelete),
				middleware.RequirePolicyStepUp(jwtSvc, stepUpPolicyRepo, "policy.delete", true),
				securityPolicyH.Delete,
			)
		}

		referenceOptions := auth.Group("/reference-options")
		referenceOptions.Use(middleware.RequirePermission(permission.PermissionOptionRead))
		{
			referenceOptions.GET("", referenceOptionH.List)
			referenceOptions.GET("/:id", referenceOptionH.Get)
			referenceOptions.POST("",
				middleware.RequirePermission(permission.PermissionOptionCreate),
				middleware.RequireStepUp(jwtSvc),
				referenceOptionH.Create,
			)
			referenceOptions.PUT("/:id",
				middleware.RequirePermission(permission.PermissionOptionUpdate),
				middleware.RequireStepUp(jwtSvc),
				referenceOptionH.Update,
			)
			referenceOptions.DELETE("/:id",
				middleware.RequirePermission(permission.PermissionOptionDelete),
				middleware.RequireStepUp(jwtSvc),
				referenceOptionH.Delete,
			)
		}

		// ── Logs — requires audit.read or auth.read ──────────────────────────
		logs := auth.Group("/logs")
		{
			logs.GET("/audit",
				middleware.RequirePermission(permission.PermissionAuditRead),
				logH.ListAuditLogs,
			)
			logs.GET("/auth",
				middleware.RequirePermission(permission.PermissionAuthRead),
				logH.ListAuthHistory,
			)
		}

		devices := auth.Group("/devices")
		devices.Use(middleware.RequirePermission(permission.PermissionDeviceRead))
		{
			devices.GET("", authH.Devices)
			devices.DELETE("/:id",
				middleware.RequirePermission(permission.PermissionDeviceRevoke),
				middleware.RequirePolicyStepUp(jwtSvc, stepUpPolicyRepo, "device.revoke", true),
				authH.RevokeDevice,
			)
		}
	}

	return r
}

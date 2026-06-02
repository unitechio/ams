package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/owner/auth-server/internal/authorization/authz"
	"github.com/owner/auth-server/internal/authorization/permission"
	jwtpkg "github.com/owner/auth-server/internal/jwt"
)

// ─── Auth Middleware ──────────────────────────────────────────────────────────

// Authenticate validates the Bearer JWT and injects:
// - user ID, username into context
// - PermissionSet (built from DB permissions) into context
//
// IMPORTANT: permissions are loaded from DB on every request or from cache.
// We NEVER trust permissions embedded in the JWT payload (which can be stale).
func Authenticate(jwtSvc *jwtpkg.Service, loader PermissionLoader) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, errorResponse("Chưa xác thực"))
			return
		}

		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, errorResponse("Token không hợp lệ"))
			return
		}

		claims, err := jwtSvc.ValidateToken(parts[1])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, errorResponse(err.Error()))
			return
		}

		// Load fresh permissions from DB (source of truth)
		rolePerms, err := loader.LoadForUser(claims.UserID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, errorResponse("Lỗi tải quyền hạn"))
			return
		}

		// Build PermissionSet
		eps := make([]permission.EffectivePermission, len(rolePerms))
		for i, rp := range rolePerms {
			eps[i] = permission.EffectivePermission{
				Permission: rp.Code,
				Scope:      rp.Scope,
			}
		}
		ps := permission.NewPermissionSet(eps)

		// Inject into Gin context
		c.Set("userID", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("sessionID", claims.SessionID)
		c.Set("clientID", claims.ClientID)
		c.Set("permissionSet", ps)

		// Also inject into request context for use in service/usecase layer
		ctx := authz.WithUserID(c.Request.Context(), claims.UserID)
		ctx = authz.WithUsername(ctx, claims.Username)
		ctx = authz.WithPermissionSet(ctx, ps)
		c.Request = c.Request.WithContext(ctx)

		c.Next()
	}
}

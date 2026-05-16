// Package middleware provides Gin middleware for authentication and
// PERMISSION-BASED authorization. Role is never used for authorization here.
package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/owner/auth-server/internal/authorization/authz"
	"github.com/owner/auth-server/internal/authorization/permission"
	"github.com/owner/auth-server/internal/domain"
	jwtpkg "github.com/owner/auth-server/internal/jwt"
)

// ─── Dependency Interface ─────────────────────────────────────────────────────

// PermissionLoader loads effective permissions for a user from persistent store.
// Injected to keep middleware decoupled from concrete repositories.
type PermissionLoader interface {
	LoadForUser(userID uint) ([]*domain.RolePermission, error)
}

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
		c.Set("permissionSet", ps)

		// Also inject into request context for use in service/usecase layer
		ctx := authz.WithUserID(c.Request.Context(), claims.UserID)
		ctx = authz.WithUsername(ctx, claims.Username)
		ctx = authz.WithPermissionSet(ctx, ps)
		c.Request = c.Request.WithContext(ctx)

		c.Next()
	}
}

// ─── Permission Guard Middleware ──────────────────────────────────────────────

// RequirePermission enforces that the authenticated user has the given permission.
// This is the ONLY way feature authorization should happen - NEVER check roles.
//
// Usage:
//
//	router.GET("/users", middleware.RequirePermission(permission.PermissionUserRead), handler.ListUsers)
func RequirePermission(p permission.Permission) gin.HandlerFunc {
	return func(c *gin.Context) {
		ps := extractPermSet(c)
		if ps == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, errorResponse("Chưa xác thực"))
			return
		}
		if !ps.Has(p) {
			c.AbortWithStatusJSON(http.StatusForbidden, forbiddenResponse(string(p)))
			return
		}
		c.Next()
	}
}

// RequirePermissionWithScope enforces permission AND minimum data scope.
//
// Usage:
//
//	RequirePermissionWithScope(permission.PermissionReportExport, permission.ScopeDepartment)
func RequirePermissionWithScope(p permission.Permission, minScope permission.Scope) gin.HandlerFunc {
	return func(c *gin.Context) {
		ps := extractPermSet(c)
		if ps == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, errorResponse("Chưa xác thực"))
			return
		}
		if !ps.HasWithScope(p, minScope) {
			c.AbortWithStatusJSON(http.StatusForbidden, forbiddenResponse(string(p)))
			return
		}
		c.Next()
	}
}

// RequireAnyPermission passes if user has at least ONE of the given permissions
func RequireAnyPermission(perms ...permission.Permission) gin.HandlerFunc {
	return func(c *gin.Context) {
		ps := extractPermSet(c)
		if ps == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, errorResponse("Chưa xác thực"))
			return
		}
		for _, p := range perms {
			if ps.Has(p) {
				c.Next()
				return
			}
		}
		c.AbortWithStatusJSON(http.StatusForbidden, forbiddenResponse(""))
	}
}

// ─── Scope Injection Middleware ───────────────────────────────────────────────

// InjectScope reads the effective scope for a given permission from the PermissionSet
// and sets it in Gin context so repositories can use it for data filtering.
//
// Usage: inject scope before handlers that do data filtering
func InjectScope(p permission.Permission) gin.HandlerFunc {
	return func(c *gin.Context) {
		ps := extractPermSet(c)
		if ps == nil {
			c.Next()
			return
		}
		scope, ok := ps.GetScope(p)
		if ok {
			c.Set("scope", string(scope))
		} else if ps.IsSuperAdmin() {
			c.Set("scope", string(permission.ScopeGlobal))
		} else {
			c.Set("scope", string(permission.ScopeSelf))
		}
		c.Next()
	}
}

// ─── Context Helpers ──────────────────────────────────────────────────────────

func GetUserID(c *gin.Context) uint {
	val, _ := c.Get("userID")
	id, _ := val.(uint)
	return id
}

func GetUsername(c *gin.Context) string {
	val, _ := c.Get("username")
	s, _ := val.(string)
	return s
}

func GetScope(c *gin.Context) permission.Scope {
	val, _ := c.Get("scope")
	s, _ := val.(string)
	if s == "" {
		return permission.ScopeSelf
	}
	return permission.Scope(s)
}

func extractPermSet(c *gin.Context) *permission.PermissionSet {
	val, exists := c.Get("permissionSet")
	if !exists {
		return nil
	}
	ps, _ := val.(*permission.PermissionSet)
	return ps
}

// ─── Response helpers ─────────────────────────────────────────────────────────

func errorResponse(msg string) gin.H {
	return gin.H{"success": false, "error": msg}
}

func forbiddenResponse(perm string) gin.H {
	msg := "Không có quyền truy cập"
	if perm != "" {
		msg = "Yêu cầu quyền: " + perm
	}
	return gin.H{"success": false, "error": msg, "code": "FORBIDDEN"}
}

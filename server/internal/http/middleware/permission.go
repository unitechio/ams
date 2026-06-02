// Package middleware provides Gin middleware for authentication and
// PERMISSION-BASED authorization. Role is never used for authorization here.
package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"
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

type StepUpPolicyRepository interface {
	List(ctx context.Context, filters map[string]interface{}) ([]*domain.SecurityPolicy, int64, error)
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

func RequireStepUp(jwtSvc *jwtpkg.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr := strings.TrimSpace(c.GetHeader("X-Step-Up-Token"))
		if tokenStr == "" {
			c.AbortWithStatusJSON(http.StatusPreconditionRequired, gin.H{
				"success": false,
				"error":   "Cần xác thực lại để thực hiện thao tác nhạy cảm",
				"code":    "STEP_UP_REQUIRED",
			})
			return
		}
		claims, err := jwtSvc.ValidateToken(tokenStr)
		if err != nil || claims.Purpose != "step_up" {
			c.AbortWithStatusJSON(http.StatusPreconditionRequired, gin.H{
				"success": false,
				"error":   "Phiên xác thực nâng cao không hợp lệ hoặc đã hết hạn",
				"code":    "STEP_UP_REQUIRED",
			})
			return
		}
		if claims.UserID != GetUserID(c) || claims.SessionID != GetSessionID(c) || claims.ClientID != GetClientID(c) {
			c.AbortWithStatusJSON(http.StatusPreconditionRequired, gin.H{
				"success": false,
				"error":   "Phiên xác thực nâng cao không khớp với phiên hiện tại",
				"code":    "STEP_UP_REQUIRED",
			})
			return
		}
		c.Next()
	}
}

func RequirePolicyStepUp(jwtSvc *jwtpkg.Service, repo StepUpPolicyRepository, action string, fallbackRequired bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		required := fallbackRequired
		if repo != nil {
			if decision, ok := resolveStepUpRequirement(repo, GetClientID(c), action); ok {
				required = decision
			}
		}
		if !required {
			c.Next()
			return
		}
		RequireStepUp(jwtSvc)(c)
	}
}

type stepUpPolicyConfig struct {
	RequireStepUp *bool `json:"require_step_up,omitempty"`
}

func resolveStepUpRequirement(repo StepUpPolicyRepository, clientID, action string) (bool, bool) {
	items, _, err := repo.List(context.Background(), map[string]interface{}{
		"policy_type":   "step_up",
		"target_action": action,
		"active":        "true",
		"page":          1,
		"page_size":     500,
	})
	if err != nil || len(items) == 0 {
		return false, false
	}
	applicable := make([]*domain.SecurityPolicy, 0, len(items))
	for _, item := range items {
		if stepUpApplies(item, clientID, action) {
			applicable = append(applicable, item)
		}
	}
	if len(applicable) == 0 {
		return false, false
	}
	sort.SliceStable(applicable, func(i, j int) bool {
		if applicable[i].Priority == applicable[j].Priority {
			return stepUpSpecificity(applicable[i]) > stepUpSpecificity(applicable[j])
		}
		return applicable[i].Priority < applicable[j].Priority
	})
	cfg := stepUpPolicyConfig{}
	if err := json.Unmarshal([]byte(applicable[0].ConfigJSON), &cfg); err != nil || cfg.RequireStepUp == nil {
		return false, false
	}
	return *cfg.RequireStepUp, true
}

func stepUpApplies(item *domain.SecurityPolicy, clientID, action string) bool {
	if strings.TrimSpace(item.TargetAction) != "" && !strings.EqualFold(strings.TrimSpace(item.TargetAction), strings.TrimSpace(action)) {
		return false
	}
	switch strings.TrimSpace(item.ScopeType) {
	case "", "global":
		return true
	case "client":
		return strings.EqualFold(strings.TrimSpace(item.TargetClient), strings.TrimSpace(clientID))
	default:
		return false
	}
}

func stepUpSpecificity(item *domain.SecurityPolicy) int {
	switch strings.TrimSpace(item.ScopeType) {
	case "client":
		return 2
	case "global", "":
		return 1
	default:
		return 0
	}
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

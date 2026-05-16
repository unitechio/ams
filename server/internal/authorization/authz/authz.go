// Package authz provides the central authorization service.
// Authorization decisions are based ONLY on permissions, never on roles directly.
// Roles are merely a grouping mechanism for permissions.
package authz

import (
	"context"
	"errors"

	"github.com/owner/auth-server/internal/authorization/permission"
)

// ─── Context Keys ─────────────────────────────────────────────────────────────

type contextKey string

const (
	ctxKeyPermissionSet contextKey = "permissionSet"
	ctxKeyUserID        contextKey = "userID"
	ctxKeyUsername      contextKey = "username"
)

// ─── Error Types ──────────────────────────────────────────────────────────────

var (
	ErrForbidden    = errors.New("forbidden: insufficient permissions")
	ErrUnauthorized = errors.New("unauthorized: authentication required")
	ErrNoPermSet    = errors.New("permission set not found in context")
)

// ─── Authorization Service Interface ─────────────────────────────────────────

// Authorizer defines the authorization contract.
// All authorization decisions flow through this interface.
type Authorizer interface {
	// HasPermission checks if user has a given permission (ignores scope)
	HasPermission(ctx context.Context, p permission.Permission) bool

	// HasPermissionWithScope checks if user has permission AND sufficient scope
	HasPermissionWithScope(ctx context.Context, p permission.Permission, required permission.Scope) bool

	// HasAny returns true if user has at least one of the given permissions
	HasAny(ctx context.Context, perms ...permission.Permission) bool

	// HasAll returns true only if user has ALL given permissions
	HasAll(ctx context.Context, perms ...permission.Permission) bool

	// GetScope returns the effective scope for a given permission
	GetScope(ctx context.Context, p permission.Permission) (permission.Scope, bool)

	// IsSuperAdmin returns true for wildcard permission holders
	IsSuperAdmin(ctx context.Context) bool

	// Require enforces permission check, returns ErrForbidden if denied
	Require(ctx context.Context, p permission.Permission) error

	// RequireWithScope enforces permission + scope check
	RequireWithScope(ctx context.Context, p permission.Permission, required permission.Scope) error
}

// ─── Default Implementation ───────────────────────────────────────────────────

type authService struct{}

// New creates the default authorization service implementation.
// It reads the PermissionSet from context (injected by middleware).
func New() Authorizer {
	return &authService{}
}

func (a *authService) getSet(ctx context.Context) *permission.PermissionSet {
	val := ctx.Value(ctxKeyPermissionSet)
	if val == nil {
		return nil
	}
	ps, _ := val.(*permission.PermissionSet)
	return ps
}

func (a *authService) HasPermission(ctx context.Context, p permission.Permission) bool {
	ps := a.getSet(ctx)
	if ps == nil {
		return false
	}
	return ps.Has(p)
}

func (a *authService) HasPermissionWithScope(ctx context.Context, p permission.Permission, required permission.Scope) bool {
	ps := a.getSet(ctx)
	if ps == nil {
		return false
	}
	return ps.HasWithScope(p, required)
}

func (a *authService) HasAny(ctx context.Context, perms ...permission.Permission) bool {
	for _, p := range perms {
		if a.HasPermission(ctx, p) {
			return true
		}
	}
	return false
}

func (a *authService) HasAll(ctx context.Context, perms ...permission.Permission) bool {
	for _, p := range perms {
		if !a.HasPermission(ctx, p) {
			return false
		}
	}
	return true
}

func (a *authService) GetScope(ctx context.Context, p permission.Permission) (permission.Scope, bool) {
	ps := a.getSet(ctx)
	if ps == nil {
		return "", false
	}
	return ps.GetScope(p)
}

func (a *authService) IsSuperAdmin(ctx context.Context) bool {
	ps := a.getSet(ctx)
	if ps == nil {
		return false
	}
	return ps.IsSuperAdmin()
}

func (a *authService) Require(ctx context.Context, p permission.Permission) error {
	if !a.HasPermission(ctx, p) {
		return ErrForbidden
	}
	return nil
}

func (a *authService) RequireWithScope(ctx context.Context, p permission.Permission, required permission.Scope) error {
	if !a.HasPermissionWithScope(ctx, p, required) {
		return ErrForbidden
	}
	return nil
}

// ─── Context Helpers ──────────────────────────────────────────────────────────

// WithPermissionSet injects a PermissionSet into context (called by middleware)
func WithPermissionSet(ctx context.Context, ps *permission.PermissionSet) context.Context {
	return context.WithValue(ctx, ctxKeyPermissionSet, ps)
}

// WithUserID injects user ID into context
func WithUserID(ctx context.Context, id uint) context.Context {
	return context.WithValue(ctx, ctxKeyUserID, id)
}

// WithUsername injects username into context
func WithUsername(ctx context.Context, name string) context.Context {
	return context.WithValue(ctx, ctxKeyUsername, name)
}

// ExtractUserID reads user ID from context
func ExtractUserID(ctx context.Context) (uint, bool) {
	val := ctx.Value(ctxKeyUserID)
	if val == nil {
		return 0, false
	}
	id, ok := val.(uint)
	return id, ok
}

// ExtractUsername reads username from context
func ExtractUsername(ctx context.Context) (string, bool) {
	val := ctx.Value(ctxKeyUsername)
	if val == nil {
		return "", false
	}
	name, ok := val.(string)
	return name, ok
}

// ExtractPermissionSet reads PermissionSet from context
func ExtractPermissionSet(ctx context.Context) (*permission.PermissionSet, bool) {
	val := ctx.Value(ctxKeyPermissionSet)
	if val == nil {
		return nil, false
	}
	ps, ok := val.(*permission.PermissionSet)
	return ps, ok
}

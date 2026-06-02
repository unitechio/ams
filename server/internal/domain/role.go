package domain

import (
	"context"
	"time"

	"github.com/owner/auth-server/internal/authorization/permission"
)

// Role is a named grouping of permissions.
// IMPORTANT: role is NEVER used directly for feature authorization.
// It is only a convenience mechanism for grouping permissions.
type Role struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Name        string    `gorm:"uniqueIndex;size:100;not null" json:"name"`
	Description string    `gorm:"size:500;default:''" json:"description"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
	CreatedBy   string    `gorm:"size:100;default:''" json:"created_by"`
	Deleted     bool      `gorm:"default:false" json:"-"`

	// Lazy-loaded — not persisted.
	Permissions []*RolePermission `gorm:"-" json:"permissions,omitempty"`
}

func (Role) TableName() string { return "sys_roles" }

// RolePermission maps a role to a permission with a specific scope.
// Scope controls DATA-LEVEL access (self / department / org / global).
type RolePermission struct {
	ID           uint               `gorm:"primaryKey;autoIncrement" json:"id"`
	RoleID       uint               `gorm:"not null;index" json:"role_id"`
	PermissionID uint               `gorm:"not null;index" json:"permission_id"`
	Scope        permission.Scope   `gorm:"size:50;not null;default:'self'" json:"scope"`
	Deleted      bool               `gorm:"default:false" json:"-"`

	// Populated from join — not a DB column.
	Code permission.Permission `gorm:"-" json:"code,omitempty"`
}

func (RolePermission) TableName() string { return "sys_role_permissions" }

// UserRole is the join table between users and roles.
type UserRole struct {
	ID      uint `gorm:"primaryKey;autoIncrement"`
	UserID  uint `gorm:"not null;index"`
	RoleID  uint `gorm:"not null;index"`
	Deleted bool `gorm:"default:false"`
}

func (UserRole) TableName() string { return "sys_user_roles" }

// RoleRepository defines data access for the Role aggregate.
type RoleRepository interface {
	FindByID(ctx context.Context, id uint) (*Role, error)
	List(ctx context.Context, spec interface{}) ([]*Role, int64, error)
	Save(ctx context.Context, r *Role) error
	Delete(ctx context.Context, id uint) error
	AssignPermissions(ctx context.Context, roleID uint, perms []RolePermission) error
	GetUserCount(ctx context.Context, roleID uint) int64
}

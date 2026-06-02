package domain

import (
	"context"
	"time"

	"github.com/owner/auth-server/internal/authorization/permission"
)

// PermissionDef defines a named permission with its code and metadata.
type PermissionDef struct {
	ID          uint                 `gorm:"primaryKey;autoIncrement" json:"id"`
	Code        permission.Permission `gorm:"uniqueIndex;size:200;not null" json:"code"`
	Name        string               `gorm:"size:200;not null" json:"name"`
	Description string               `gorm:"size:500;default:''" json:"description"`
	GroupName   string               `gorm:"size:100;not null;default:''" json:"group_name"`
	CreatedAt   time.Time            `gorm:"autoCreateTime" json:"created_at"`
	Deleted     bool                 `gorm:"default:false" json:"-"`
}

func (PermissionDef) TableName() string { return "sys_permission_defs" }

// PermissionLine represents a specific controller:action pair for a permission.
type PermissionLine struct {
	ID           uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	PermissionID uint      `gorm:"not null;index" json:"permission_id"`
	Controller   string    `gorm:"size:200;not null" json:"controller"`
	Action       string    `gorm:"size:200;not null" json:"action"`
	Note         string    `gorm:"size:500;default:''" json:"note"`
	CreatedAt    time.Time `gorm:"autoCreateTime" json:"created_at"`
	CreatedBy    string    `gorm:"size:100;default:''" json:"created_by"`
	Deleted      bool      `gorm:"default:false" json:"-"`
}

func (PermissionLine) TableName() string { return "sys_permission_lines" }

// PermissionRepository defines data access for permissions.
type PermissionRepository interface {
	FindAll(ctx context.Context) ([]*PermissionDef, error)
	FindByCode(ctx context.Context, code permission.Permission) (*PermissionDef, error)
	FindByUserID(ctx context.Context, userID uint) ([]*RolePermission, error)
	Save(ctx context.Context, p *PermissionDef) error
	AddLine(ctx context.Context, line *PermissionLine) error
	DeleteLine(ctx context.Context, id uint) error
	GetLines(ctx context.Context, permissionID uint) ([]*PermissionLine, error)
}

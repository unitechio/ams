package domain

import (
	"context"

	"github.com/owner/auth-server/internal/authorization/permission"
)

// Menu represents a navigation item in the system.
// Visibility is controlled by the linked PermissionCode.
type Menu struct {
	ID             uint                 `gorm:"primaryKey;autoIncrement" json:"id"`
	Title          string               `gorm:"size:200;not null" json:"title"`
	URL            string               `gorm:"size:500;default:'#'" json:"url"`
	SortOrder      int                  `gorm:"default:0" json:"sort_order"`
	Icon           string               `gorm:"size:100;default:''" json:"icon"`
	PermissionCode permission.Permission `gorm:"size:200;default:''" json:"permission_code"`
	ParentID       *uint                `gorm:"column:parent_id" json:"parent_id,omitempty"`
	MenuType       string               `gorm:"size:50;not null;default:'main'" json:"menu_type"` // main | sub | separator
	Deleted        bool                 `gorm:"default:false" json:"-"`

	// Computed by tree builder — not persisted.
	Children []*Menu `gorm:"-" json:"children,omitempty"`
}

func (Menu) TableName() string { return "sys_menus" }

// MenuRepository defines data access for menus.
type MenuRepository interface {
	FindAll(ctx context.Context) ([]*Menu, error)
	FindByID(ctx context.Context, id uint) (*Menu, error)
	Save(ctx context.Context, m *Menu) error
	Delete(ctx context.Context, id uint) error
	ListPaginated(ctx context.Context, spec interface{}) ([]*Menu, int64, error)
}

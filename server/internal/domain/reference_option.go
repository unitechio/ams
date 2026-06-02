package domain

import (
	"context"
	"time"
)

// ReferenceOption is a generic key-value lookup table entry.
type ReferenceOption struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	OptionGroup string    `gorm:"size:100;not null;index:idx_sys_reference_options_group_value,unique" json:"option_group"`
	Value       string    `gorm:"size:150;not null;index:idx_sys_reference_options_group_value,unique" json:"value"`
	Label       string    `gorm:"size:200;not null" json:"label"`
	Description string    `gorm:"size:600;default:''" json:"description"`
	MetaJSON    string    `gorm:"type:text;default:'{}'" json:"meta_json"`
	SortOrder   int       `gorm:"default:100" json:"sort_order"`
	Active      bool      `gorm:"default:true" json:"active"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (ReferenceOption) TableName() string { return "sys_reference_options" }

// ReferenceOptionRepository defines data access for reference options.
type ReferenceOptionRepository interface {
	FindByID(ctx context.Context, id uint) (*ReferenceOption, error)
	List(ctx context.Context, filters map[string]interface{}) ([]*ReferenceOption, int64, error)
	Save(ctx context.Context, item *ReferenceOption) error
	Delete(ctx context.Context, id uint) error
}

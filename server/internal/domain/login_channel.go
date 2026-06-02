package domain

import (
	"context"
	"time"
)

// LoginChannel defines a login entry point with its own security profile.
type LoginChannel struct {
	ID                    uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Code                  string    `gorm:"uniqueIndex;size:100;not null" json:"code"`
	Name                  string    `gorm:"size:200;not null" json:"name"`
	Description           string    `gorm:"size:500;default:''" json:"description"`
	RiskLevel             string    `gorm:"size:50;default:'medium'" json:"risk_level"` // low | medium | high
	RequireMFA            bool      `gorm:"default:false" json:"require_mfa"`
	AllowPassword         bool      `gorm:"default:true" json:"allow_password"`
	AllowSSO              bool      `gorm:"default:true" json:"allow_sso"`
	TrustedDeviceTTLHours int       `gorm:"default:720" json:"trusted_device_ttl_hours"`
	SessionTTLMinutes     int       `gorm:"default:1440" json:"session_ttl_minutes"`
	Active                bool      `gorm:"default:true" json:"active"`
	CreatedAt             time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt             time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (LoginChannel) TableName() string { return "sys_login_channels" }

// LoginChannelRepository defines data access for login channels.
type LoginChannelRepository interface {
	FindByCode(ctx context.Context, code string) (*LoginChannel, error)
	List(ctx context.Context, filters map[string]interface{}) ([]*LoginChannel, int64, error)
	Save(ctx context.Context, channel *LoginChannel) error
	Delete(ctx context.Context, id uint) error
}

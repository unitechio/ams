package domain

import (
	"context"
	"time"
)

// RefreshToken tracks active sessions and enables token rotation.
type RefreshToken struct {
	ID                uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID            uint       `gorm:"not null;index" json:"user_id"`
	Token             string     `gorm:"uniqueIndex;size:512;not null" json:"-"`
	SessionID         string     `gorm:"size:128;index" json:"session_id"`
	TokenFamily       string     `gorm:"size:128;index" json:"token_family"`
	ClientID          string     `gorm:"size:128;index" json:"client_id"`
	DeviceName        string     `gorm:"size:255;default:''" json:"device_name"`
	DeviceFingerprint string     `gorm:"size:255;index;default:''" json:"device_fingerprint"`
	IPAddress         string     `gorm:"size:50;default:''" json:"ip_address"`
	UserAgent         string     `gorm:"size:500;default:''" json:"user_agent"`
	Trusted           bool       `gorm:"default:false" json:"trusted"`
	RotatedFrom       string     `gorm:"size:512;default:''" json:"-"`
	RevokedReason     string     `gorm:"size:255;default:''" json:"revoked_reason,omitempty"`
	ExpiresAt         time.Time  `gorm:"not null" json:"expires_at"`
	LastUsedAt        time.Time  `json:"last_used_at"`
	ReuseDetectedAt   *time.Time `gorm:"column:reuse_detected_at" json:"-"`
	Revoked           bool       `gorm:"default:false" json:"revoked"`
	CreatedAt         time.Time  `gorm:"autoCreateTime" json:"created_at"`

	// Populated via JOIN — not a DB column.
	Username  string `gorm:"-" json:"username,omitempty"`
	UserEmail string `gorm:"-" json:"user_email,omitempty"`
}

func (RefreshToken) TableName() string { return "sys_refresh_tokens" }

// TokenRepository manages refresh tokens and sessions.
type TokenRepository interface {
	Save(ctx context.Context, t *RefreshToken) error
	FindByToken(ctx context.Context, token string) (*RefreshToken, error)
	RevokeByUserID(ctx context.Context, userID uint) error
	RevokeToken(ctx context.Context, token string) error
	RevokeSession(ctx context.Context, userID uint, sessionID string) error
	RevokeSessionByID(ctx context.Context, sessionID string) error
	RevokeFamily(ctx context.Context, familyID string, reason string) error
	ListActiveSessions(ctx context.Context, userID uint) ([]*RefreshToken, error)
	ListSessions(ctx context.Context, filters map[string]interface{}) ([]*RefreshToken, int64, error)
	FindTrustedDevice(ctx context.Context, userID uint, clientID, fingerprint string) (*RefreshToken, error)
}

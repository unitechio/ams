package domain

import (
	"context"
	"time"
)

// AuditLog records all significant system actions.
type AuditLog struct {
	ID         uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID     uint      `gorm:"index" json:"user_id"`
	Username   string    `gorm:"size:100;default:''" json:"username"`
	Action     string    `gorm:"size:200;not null" json:"action"`
	Resource   string    `gorm:"size:100;default:''" json:"resource"`
	ResourceID string    `gorm:"size:100;default:''" json:"resource_id"`
	IPAddress  string    `gorm:"size:50;default:''" json:"ip_address"`
	UserAgent  string    `gorm:"size:500;default:''" json:"user_agent"`
	Request    string    `gorm:"type:text" json:"request"`
	Response   string    `gorm:"type:text" json:"response"`
	Allowed    bool      `gorm:"default:true" json:"allowed"`
	CreatedAt  time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func (AuditLog) TableName() string { return "sys_audit_logs" }

// AuthHistory records each login attempt (success or failure).
type AuthHistory struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    uint      `gorm:"index" json:"user_id"`
	Username  string    `gorm:"size:100;default:''" json:"username"`
	IPAddress string    `gorm:"size:50;default:''" json:"ip_address"`
	UserAgent string    `gorm:"size:500;default:''" json:"user_agent"`
	Status    string    `gorm:"size:50;default:''" json:"status"` // success | failed | locked
	Note      string    `gorm:"size:500;default:''" json:"note"`
	CreatedAt time.Time `gorm:"index;autoCreateTime" json:"created_at"`
}

func (AuthHistory) TableName() string { return "sys_auth_histories" }

// AuditLogRepository for audit logging.
type AuditLogRepository interface {
	Save(ctx context.Context, log *AuditLog) error
	List(ctx context.Context, spec interface{}) ([]*AuditLog, int64, error)
}

// AuthHistoryRepository for login history.
type AuthHistoryRepository interface {
	Save(ctx context.Context, h *AuthHistory) error
	List(ctx context.Context, spec interface{}) ([]*AuthHistory, int64, error)
}

package domain

import (
	"context"
	"time"

	"github.com/owner/auth-server/internal/authorization/permission"
)

// User is the core authentication and authorization entity.
// GORM tags are present so this struct is used directly by the repository layer —
// no separate "model" struct is needed.
//
// Fields with gorm:"-" are computed/lazy-loaded and never persisted directly.
type User struct {
	ID                uint       `gorm:"primaryKey;autoIncrement"                   json:"id"`
	Username          string     `gorm:"uniqueIndex;size:100;not null"               json:"username"`
	PasswordHash      string     `gorm:"size:255;not null"                           json:"-"`
	PasswordHistory   []string   `gorm:"serializer:json;type:text;default:'[]'"      json:"-"`
	AllowedClients    []string   `gorm:"serializer:json;type:text;default:'[]'"      json:"allowed_clients,omitempty"`
	AllowedChannels   []string   `gorm:"serializer:json;type:text;default:'[]'"      json:"allowed_channels,omitempty"`
	EmailVerified     bool       `gorm:"default:false"                               json:"email_verified"`
	EmailOTPHash      string     `gorm:"size:255;default:''"                         json:"-"`
	EmailOTPExpiresAt *time.Time `gorm:"column:email_otp_expires_at"                 json:"-"`
	EmailVerifyHash   string     `gorm:"size:255;default:''"                         json:"-"`
	EmailVerifyExpiry *time.Time `gorm:"column:email_verify_expiry"                  json:"-"`
	TOTPSecret        string     `gorm:"size:255;default:''"                         json:"-"`
	PendingTOTPSecret string     `gorm:"size:255;default:''"                         json:"-"`
	Email             string     `gorm:"uniqueIndex;size:200"                        json:"email"`
	FullName          string     `gorm:"size:200;not null;default:''"                json:"full_name"`
	Phone             string     `gorm:"size:20;default:''"                          json:"phone,omitempty"`
	Status            string     `gorm:"size:20;default:'active'"                    json:"status"` // active | inactive | locked
	FailedLogins      int        `gorm:"default:0"                                   json:"-"`
	LockedUntil       *time.Time `gorm:"column:locked_until"                         json:"-"`
	LastLogin         *time.Time `gorm:"column:last_login"                           json:"last_login,omitempty"`
	CreatedAt         time.Time  `gorm:"autoCreateTime"                              json:"created_at"`
	UpdatedAt         time.Time  `gorm:"autoUpdateTime"                              json:"updated_at"`
	Deleted           bool       `gorm:"default:false"                               json:"-"`
	PasswordExpiresAt *time.Time `gorm:"column:password_expires_at"                  json:"-"`
	OneTimePassword   bool       `gorm:"default:false"                               json:"-"`
	RequireOTP        bool       `gorm:"default:false"                               json:"require_otp"`
	TwoFactorEnabled  bool       `gorm:"default:false"                               json:"two_factor_enabled"`

	// Lazy-loaded associations — not persisted, populated by repository.
	Roles []*Role `gorm:"-" json:"roles,omitempty"`
}

func (User) TableName() string { return "sys_users" }

// EffectivePermissions resolves all permissions from user's roles.
func (u *User) EffectivePermissions() *permission.PermissionSet {
	var eps []permission.EffectivePermission
	for _, role := range u.Roles {
		for _, rp := range role.Permissions {
			eps = append(eps, permission.EffectivePermission{
				Permission: rp.Code,
				Scope:      rp.Scope,
			})
		}
	}
	return permission.NewPermissionSet(eps)
}

// IsActive returns true if the user can authenticate.
func (u *User) IsActive() bool { return u.Status == "active" && !u.Deleted }

// IsLocked returns true if the account is temporarily locked.
func (u *User) IsLocked() bool {
	if u.Status == "locked" {
		return true
	}
	if u.LockedUntil != nil && u.LockedUntil.After(time.Now()) {
		return true
	}
	return false
}

// UserRepository defines data access for the User aggregate.
type UserRepository interface {
	FindByID(ctx context.Context, id uint) (*User, error)
	FindByUsername(ctx context.Context, username string) (*User, error)
	FindByEmail(ctx context.Context, email string) (*User, error)
	List(ctx context.Context, spec interface{}) ([]*User, int64, error)
	Save(ctx context.Context, u *User) error
	Delete(ctx context.Context, id uint) error
	SetRoles(ctx context.Context, userID uint, roleIDs []uint) error
	UpdateLastLogin(ctx context.Context, userID uint) error
	UpdateFailedLogin(ctx context.Context, userID uint, count int, lockedUntil *time.Time) error
}

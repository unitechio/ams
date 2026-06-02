package domain

import (
	"context"
	"time"
)

// AuthClient represents an OAuth2 / OIDC registered application.
type AuthClient struct {
	ID                  uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	ClientID            string     `gorm:"uniqueIndex;size:150;not null" json:"client_id"`
	ClientSecret        string     `gorm:"size:255;default:''" json:"-"`
	Name                string     `gorm:"size:200;not null" json:"name"`
	Description         string     `gorm:"size:500;default:''" json:"description"`
	AppType             string     `gorm:"size:50;not null;default:'web_app'" json:"app_type"`
	ClientTemplate      string     `gorm:"size:50;default:'custom'" json:"client_template"`
	Environment         string     `gorm:"size:30;default:'prod'" json:"environment"`
	DomainGroup         string     `gorm:"size:100;default:'core'" json:"domain_group"`
	OwnerTeam           string     `gorm:"size:120;default:''" json:"owner_team"`
	Public              bool       `gorm:"default:true" json:"public"`
	PKCERequired        bool       `gorm:"default:false" json:"pkce_required"`
	Active              bool       `gorm:"default:true" json:"active"`
	LegacyPasswordGrant bool       `gorm:"default:false" json:"legacy_password_grant"`
	ApprovalStatus      string     `gorm:"size:30;default:'approved'" json:"approval_status"`
	GrantTypes          []string   `gorm:"serializer:json;type:text;default:'[]'" json:"grant_types"`
	RedirectURIs        []string   `gorm:"serializer:json;type:text;default:'[]'" json:"redirect_uris"`
	Audiences           []string   `gorm:"serializer:json;type:text;default:'[]'" json:"audiences"`
	Channels            []string   `gorm:"serializer:json;type:text;default:'[]'" json:"channels"`
	TrustedTypes        []string   `gorm:"serializer:json;type:text;default:'[]'" json:"trusted_types"`
	Tags                []string   `gorm:"serializer:json;type:text;default:'[]'" json:"tags"`
	SecretVersion       int        `gorm:"default:1" json:"secret_version"`
	SecretRotatedAt     *time.Time `gorm:"column:secret_rotated_at" json:"secret_rotated_at,omitempty"`
	SecretExpiresAt     *time.Time `gorm:"column:secret_expires_at" json:"secret_expires_at,omitempty"`
	CreatedAt           time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt           time.Time  `gorm:"autoUpdateTime" json:"updated_at"`
}

func (AuthClient) TableName() string { return "sys_auth_clients" }

// ClientRepository defines data access for OAuth clients.
type ClientRepository interface {
	FindByClientID(ctx context.Context, clientID string) (*AuthClient, error)
	List(ctx context.Context, filters map[string]interface{}) ([]*AuthClient, int64, error)
	Save(ctx context.Context, client *AuthClient) error
	Delete(ctx context.Context, id uint) error
}

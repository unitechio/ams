package domain

import (
	"context"
	"time"
)

// SSOProvider represents an external identity provider (OIDC or SAML).
type SSOProvider struct {
	ID                 uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	ProviderID         string    `gorm:"uniqueIndex;size:100;not null" json:"provider_id"`
	Name               string    `gorm:"size:200;not null" json:"name"`
	Type               string    `gorm:"size:50;not null;default:'oidc'" json:"type"` // oidc | saml
	ClientID           string    `gorm:"size:255;default:''" json:"client_id"`
	ClientSecret       string    `gorm:"size:255;default:''" json:"-"`
	AuthorizeURL       string    `gorm:"size:500;default:''" json:"authorize_url"`
	TokenURL           string    `gorm:"size:500;default:''" json:"token_url"`
	UserInfoURL        string    `gorm:"size:500;default:''" json:"user_info_url"`
	RedirectURI        string    `gorm:"size:500;default:''" json:"redirect_uri"`
	Scope              string    `gorm:"size:500;default:''" json:"scope"`
	SAMLLoginURL       string    `gorm:"size:500;default:''" json:"saml_login_url"`
	Enabled            bool      `gorm:"default:true" json:"enabled"`
	AllowAutoProvision bool      `gorm:"default:true" json:"allow_auto_provision"`
	Icon               string    `gorm:"size:100;default:''" json:"icon"`
	CreatedAt          time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt          time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (SSOProvider) TableName() string { return "sys_sso_providers" }

// SSOProviderRepository defines data access for SSO providers.
type SSOProviderRepository interface {
	FindByProviderID(ctx context.Context, providerID string) (*SSOProvider, error)
	FindByID(ctx context.Context, id uint) (*SSOProvider, error)
	List(ctx context.Context, filters map[string]interface{}) ([]*SSOProvider, int64, error)
	Save(ctx context.Context, provider *SSOProvider) error
	Delete(ctx context.Context, id uint) error
}

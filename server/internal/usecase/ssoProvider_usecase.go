package usecase

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/owner/auth-server/internal/domain"
)

type CreateSSOProviderReq struct {
	ProviderID         string `json:"provider_id" binding:"required"`
	Name               string `json:"name" binding:"required"`
	Type               string `json:"type"`
	ClientID           string `json:"client_id"`
	ClientSecret       string `json:"client_secret"`
	AuthorizeURL       string `json:"authorize_url"`
	TokenURL           string `json:"token_url"`
	UserInfoURL        string `json:"user_info_url"`
	RedirectURI        string `json:"redirect_uri"`
	Scope              string `json:"scope"`
	SAMLLoginURL       string `json:"saml_login_url"`
	Enabled            bool   `json:"enabled"`
	AllowAutoProvision bool   `json:"allow_auto_provision"`
	Icon               string `json:"icon"`
}

type UpdateSSOProviderReq = CreateSSOProviderReq

type SSOProviderResponse struct {
	ID                 uint      `json:"id"`
	ProviderID         string    `json:"provider_id"`
	Name               string    `json:"name"`
	Type               string    `json:"type"`
	ClientID           string    `json:"client_id"`
	ClientSecret       string    `json:"client_secret"`
	AuthorizeURL       string    `json:"authorize_url"`
	TokenURL           string    `json:"token_url"`
	UserInfoURL        string    `json:"user_info_url"`
	RedirectURI        string    `json:"redirect_uri"`
	Scope              string    `json:"scope"`
	SAMLLoginURL       string    `json:"saml_login_url"`
	Enabled            bool      `json:"enabled"`
	AllowAutoProvision bool      `json:"allow_auto_provision"`
	Icon               string    `json:"icon"`
	CreatedAt          time.Time `json:"created_at"`
}

type SSOProviderUsecase struct {
	repo domain.SSOProviderRepository
}

func NewSSOProviderUsecase(repo domain.SSOProviderRepository) *SSOProviderUsecase {
	return &SSOProviderUsecase{repo: repo}
}

func (uc *SSOProviderUsecase) List(filters map[string]interface{}, page, pageSize int) (*PaginatedResult[SSOProviderResponse], error) {
	filters["page"] = page
	filters["page_size"] = pageSize
	providers, total, err := uc.repo.List(context.Background(), filters)
	if err != nil {
		return nil, err
	}
	data := make([]SSOProviderResponse, len(providers))
	for i, provider := range providers {
		data[i] = ssoProviderToResponse(provider)
	}
	return paginate(data, total, page, pageSize), nil
}

func (uc *SSOProviderUsecase) GetByID(id uint) (*SSOProviderResponse, error) {
	provider, err := uc.repo.FindByID(context.Background(), id)
	if err != nil {
		return nil, errors.New("SSO provider không tồn tại")
	}
	resp := ssoProviderToResponse(provider)
	return &resp, nil
}

func (uc *SSOProviderUsecase) Create(req *CreateSSOProviderReq) (*SSOProviderResponse, error) {
	provider := &domain.SSOProvider{
		ProviderID:         strings.TrimSpace(req.ProviderID),
		Name:               strings.TrimSpace(req.Name),
		Type:               strings.TrimSpace(req.Type),
		ClientID:           strings.TrimSpace(req.ClientID),
		ClientSecret:       strings.TrimSpace(req.ClientSecret),
		AuthorizeURL:       strings.TrimSpace(req.AuthorizeURL),
		TokenURL:           strings.TrimSpace(req.TokenURL),
		UserInfoURL:        strings.TrimSpace(req.UserInfoURL),
		RedirectURI:        strings.TrimSpace(req.RedirectURI),
		Scope:              strings.TrimSpace(req.Scope),
		SAMLLoginURL:       strings.TrimSpace(req.SAMLLoginURL),
		Enabled:            req.Enabled,
		AllowAutoProvision: req.AllowAutoProvision,
		Icon:               strings.TrimSpace(req.Icon),
	}
	normalizeSSOProvider(provider)
	if err := uc.repo.Save(context.Background(), provider); err != nil {
		return nil, err
	}
	resp := ssoProviderToResponse(provider)
	return &resp, nil
}

func (uc *SSOProviderUsecase) Update(id uint, req *UpdateSSOProviderReq) (*SSOProviderResponse, error) {
	provider, err := uc.findByID(id)
	if err != nil {
		return nil, err
	}
	provider.ProviderID = strings.TrimSpace(req.ProviderID)
	provider.Name = strings.TrimSpace(req.Name)
	provider.Type = strings.TrimSpace(req.Type)
	provider.ClientID = strings.TrimSpace(req.ClientID)
	provider.ClientSecret = strings.TrimSpace(req.ClientSecret)
	provider.AuthorizeURL = strings.TrimSpace(req.AuthorizeURL)
	provider.TokenURL = strings.TrimSpace(req.TokenURL)
	provider.UserInfoURL = strings.TrimSpace(req.UserInfoURL)
	provider.RedirectURI = strings.TrimSpace(req.RedirectURI)
	provider.Scope = strings.TrimSpace(req.Scope)
	provider.SAMLLoginURL = strings.TrimSpace(req.SAMLLoginURL)
	provider.Enabled = req.Enabled
	provider.AllowAutoProvision = req.AllowAutoProvision
	provider.Icon = strings.TrimSpace(req.Icon)
	normalizeSSOProvider(provider)
	if err := uc.repo.Save(context.Background(), provider); err != nil {
		return nil, err
	}
	resp := ssoProviderToResponse(provider)
	return &resp, nil
}

func (uc *SSOProviderUsecase) Delete(id uint) error {
	return uc.repo.Delete(context.Background(), id)
}

func (uc *SSOProviderUsecase) findByID(id uint) (*domain.SSOProvider, error) {
	providers, _, err := uc.repo.List(context.Background(), map[string]interface{}{"page": 1, "page_size": 500})
	if err != nil {
		return nil, err
	}
	for _, provider := range providers {
		if provider.ID == id {
			return provider, nil
		}
	}
	return nil, errors.New("provider SSO không tồn tại")
}

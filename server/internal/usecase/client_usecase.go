package usecase

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/owner/auth-server/internal/domain"
)

type CreateClientReq struct {
	ClientID            string   `json:"client_id" binding:"required"`
	ClientSecret        string   `json:"client_secret"`
	Name                string   `json:"name" binding:"required"`
	Description         string   `json:"description"`
	AppType             string   `json:"app_type"`
	ClientTemplate      string   `json:"client_template"`
	Environment         string   `json:"environment"`
	DomainGroup         string   `json:"domain_group"`
	OwnerTeam           string   `json:"owner_team"`
	Public              bool     `json:"public"`
	PKCERequired        bool     `json:"pkce_required"`
	Active              bool     `json:"active"`
	LegacyPasswordGrant bool     `json:"legacy_password_grant"`
	ApprovalStatus      string   `json:"approval_status"`
	GrantTypes          []string `json:"grant_types"`
	RedirectURIs        []string `json:"redirect_uris"`
	Audiences           []string `json:"audiences"`
	Channels            []string `json:"channels"`
	TrustedTypes        []string `json:"trusted_types"`
	Tags                []string `json:"tags"`
}

type UpdateClientReq = CreateClientReq

type ClientResponse struct {
	ID                  uint       `json:"id"`
	ClientID            string     `json:"client_id"`
	ClientSecret        string     `json:"client_secret"`
	Name                string     `json:"name"`
	Description         string     `json:"description"`
	AppType             string     `json:"app_type"`
	ClientTemplate      string     `json:"client_template"`
	Environment         string     `json:"environment"`
	DomainGroup         string     `json:"domain_group"`
	OwnerTeam           string     `json:"owner_team"`
	Public              bool       `json:"public"`
	PKCERequired        bool       `json:"pkce_required"`
	Active              bool       `json:"active"`
	LegacyPasswordGrant bool       `json:"legacy_password_grant"`
	ApprovalStatus      string     `json:"approval_status"`
	GrantTypes          []string   `json:"grant_types"`
	RedirectURIs        []string   `json:"redirect_uris"`
	Audiences           []string   `json:"audiences"`
	Channels            []string   `json:"channels"`
	TrustedTypes        []string   `json:"trusted_types"`
	Tags                []string   `json:"tags"`
	SecretVersion       int        `json:"secret_version"`
	SecretRotatedAt     *time.Time `json:"secret_rotated_at,omitempty"`
	SecretExpiresAt     *time.Time `json:"secret_expires_at,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
}

type ClientUsecase struct {
	repo        domain.ClientRepository
	channelRepo domain.LoginChannelRepository
}

func NewClientUsecase(repo domain.ClientRepository, channelRepo domain.LoginChannelRepository) *ClientUsecase {
	return &ClientUsecase{repo: repo, channelRepo: channelRepo}
}

func (uc *ClientUsecase) List(filters map[string]interface{}, page, pageSize int) (*PaginatedResult[ClientResponse], error) {
	filters["page"] = page
	filters["page_size"] = pageSize
	clients, total, err := uc.repo.List(context.Background(), filters)
	if err != nil {
		return nil, err
	}
	data := make([]ClientResponse, len(clients))
	for i, client := range clients {
		data[i] = clientToResponse(client)
	}
	return paginate(data, total, page, pageSize), nil
}

func (uc *ClientUsecase) GetByID(id uint) (*ClientResponse, error) {
	client, err := uc.findByID(id)
	if err != nil {
		return nil, err
	}
	resp := clientToResponse(client)
	return &resp, nil
}

func (uc *ClientUsecase) Create(req *CreateClientReq) (*ClientResponse, error) {
	client := &domain.AuthClient{
		ClientID:            strings.TrimSpace(req.ClientID),
		ClientSecret:        strings.TrimSpace(req.ClientSecret),
		Name:                strings.TrimSpace(req.Name),
		Description:         strings.TrimSpace(req.Description),
		AppType:             strings.TrimSpace(req.AppType),
		ClientTemplate:      strings.TrimSpace(req.ClientTemplate),
		Environment:         strings.TrimSpace(req.Environment),
		DomainGroup:         strings.TrimSpace(req.DomainGroup),
		OwnerTeam:           strings.TrimSpace(req.OwnerTeam),
		Public:              req.Public,
		PKCERequired:        req.PKCERequired,
		Active:              req.Active,
		LegacyPasswordGrant: req.LegacyPasswordGrant,
		ApprovalStatus:      strings.TrimSpace(req.ApprovalStatus),
		GrantTypes:          cleanStringList(req.GrantTypes),
		RedirectURIs:        cleanStringList(req.RedirectURIs),
		Audiences:           cleanStringList(req.Audiences),
		Channels:            cleanStringList(req.Channels),
		TrustedTypes:        cleanStringList(req.TrustedTypes),
		Tags:                cleanStringList(req.Tags),
	}
	applyClientTemplate(client)
	normalizeClient(client)
	if err := uc.validateClient(client); err != nil {
		return nil, err
	}
	if err := uc.repo.Save(context.Background(), client); err != nil {
		return nil, err
	}
	resp := clientToResponse(client)
	return &resp, nil
}

func (uc *ClientUsecase) Update(id uint, req *UpdateClientReq) (*ClientResponse, error) {
	client, err := uc.findByID(id)
	if err != nil {
		return nil, err
	}
	client.ClientID = strings.TrimSpace(req.ClientID)
	client.ClientSecret = strings.TrimSpace(req.ClientSecret)
	client.Name = strings.TrimSpace(req.Name)
	client.Description = strings.TrimSpace(req.Description)
	client.AppType = strings.TrimSpace(req.AppType)
	client.ClientTemplate = strings.TrimSpace(req.ClientTemplate)
	client.Environment = strings.TrimSpace(req.Environment)
	client.DomainGroup = strings.TrimSpace(req.DomainGroup)
	client.OwnerTeam = strings.TrimSpace(req.OwnerTeam)
	client.Public = req.Public
	client.PKCERequired = req.PKCERequired
	client.Active = req.Active
	client.LegacyPasswordGrant = req.LegacyPasswordGrant
	client.ApprovalStatus = strings.TrimSpace(req.ApprovalStatus)
	client.GrantTypes = cleanStringList(req.GrantTypes)
	client.RedirectURIs = cleanStringList(req.RedirectURIs)
	client.Audiences = cleanStringList(req.Audiences)
	client.Channels = cleanStringList(req.Channels)
	client.TrustedTypes = cleanStringList(req.TrustedTypes)
	client.Tags = cleanStringList(req.Tags)
	applyClientTemplate(client)
	normalizeClient(client)
	if err := uc.validateClient(client); err != nil {
		return nil, err
	}
	if err := uc.repo.Save(context.Background(), client); err != nil {
		return nil, err
	}
	resp := clientToResponse(client)
	return &resp, nil
}

func (uc *ClientUsecase) Delete(id uint) error {
	return uc.repo.Delete(context.Background(), id)
}

func (uc *ClientUsecase) RotateSecret(id uint) (*ClientResponse, error) {
	client, err := uc.findByID(id)
	if err != nil {
		return nil, err
	}
	if client.Public {
		return nil, errors.New("public client không dùng client_secret rotation")
	}
	now := time.Now()
	client.ClientSecret = generateOpaqueID(32)
	client.SecretVersion++
	client.SecretRotatedAt = &now
	expiry := now.Add(180 * 24 * time.Hour)
	client.SecretExpiresAt = &expiry
	if err := uc.repo.Save(context.Background(), client); err != nil {
		return nil, err
	}
	resp := clientToResponse(client)
	return &resp, nil
}

func (uc *ClientUsecase) findByID(id uint) (*domain.AuthClient, error) {
	clients, _, err := uc.repo.List(context.Background(), map[string]interface{}{"page": 1, "page_size": 500})
	if err != nil {
		return nil, err
	}
	for _, client := range clients {
		if client.ID == id {
			return client, nil
		}
	}
	return nil, errors.New("client không tồn tại")
}

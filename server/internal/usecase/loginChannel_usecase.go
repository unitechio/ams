package usecase

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/owner/auth-server/internal/domain"
)

type CreateLoginChannelReq struct {
	Code                  string `json:"code" binding:"required"`
	Name                  string `json:"name" binding:"required"`
	Description           string `json:"description"`
	RiskLevel             string `json:"risk_level"`
	RequireMFA            bool   `json:"require_mfa"`
	AllowPassword         bool   `json:"allow_password"`
	AllowSSO              bool   `json:"allow_sso"`
	TrustedDeviceTTLHours int    `json:"trusted_device_ttl_hours"`
	SessionTTLMinutes     int    `json:"session_ttl_minutes"`
	Active                bool   `json:"active"`
}

type UpdateLoginChannelReq = CreateLoginChannelReq

type LoginChannelResponse struct {
	ID                    uint      `json:"id"`
	Code                  string    `json:"code"`
	Name                  string    `json:"name"`
	Description           string    `json:"description"`
	RiskLevel             string    `json:"risk_level"`
	RequireMFA            bool      `json:"require_mfa"`
	AllowPassword         bool      `json:"allow_password"`
	AllowSSO              bool      `json:"allow_sso"`
	TrustedDeviceTTLHours int       `json:"trusted_device_ttl_hours"`
	SessionTTLMinutes     int       `json:"session_ttl_minutes"`
	Active                bool      `json:"active"`
	CreatedAt             time.Time `json:"created_at"`
}

type LoginChannelUsecase struct {
	repo domain.LoginChannelRepository
}

func NewLoginChannelUsecase(repo domain.LoginChannelRepository) *LoginChannelUsecase {
	return &LoginChannelUsecase{repo: repo}
}

func (uc *LoginChannelUsecase) List(filters map[string]interface{}, page, pageSize int) (*PaginatedResult[LoginChannelResponse], error) {
	filters["page"] = page
	filters["page_size"] = pageSize
	channels, total, err := uc.repo.List(context.Background(), filters)
	if err != nil {
		return nil, err
	}
	data := make([]LoginChannelResponse, len(channels))
	for i, channel := range channels {
		data[i] = loginChannelToResponse(channel)
	}
	return paginate(data, total, page, pageSize), nil
}

func (uc *LoginChannelUsecase) GetByID(id uint) (*LoginChannelResponse, error) {
	items, _, err := uc.repo.List(context.Background(), map[string]interface{}{
		"page":      1,
		"page_size": 1000,
	})
	if err != nil {
		return nil, err
	}
	for _, item := range items {
		if item.ID == id {
			resp := loginChannelToResponse(item)
			return &resp, nil
		}
	}
	return nil, errors.New("login channel không tồn tại")
}

func (uc *LoginChannelUsecase) Create(req *CreateLoginChannelReq) (*LoginChannelResponse, error) {
	channel := &domain.LoginChannel{
		Code:                  strings.TrimSpace(req.Code),
		Name:                  strings.TrimSpace(req.Name),
		Description:           strings.TrimSpace(req.Description),
		RiskLevel:             strings.TrimSpace(req.RiskLevel),
		RequireMFA:            req.RequireMFA,
		AllowPassword:         req.AllowPassword,
		AllowSSO:              req.AllowSSO,
		TrustedDeviceTTLHours: req.TrustedDeviceTTLHours,
		SessionTTLMinutes:     req.SessionTTLMinutes,
		Active:                req.Active,
	}
	normalizeLoginChannel(channel)
	if err := uc.repo.Save(context.Background(), channel); err != nil {
		return nil, err
	}
	resp := loginChannelToResponse(channel)
	return &resp, nil
}

func (uc *LoginChannelUsecase) Update(id uint, req *UpdateLoginChannelReq) (*LoginChannelResponse, error) {
	channel, err := uc.findByID(id)
	if err != nil {
		return nil, err
	}
	channel.Code = strings.TrimSpace(req.Code)
	channel.Name = strings.TrimSpace(req.Name)
	channel.Description = strings.TrimSpace(req.Description)
	channel.RiskLevel = strings.TrimSpace(req.RiskLevel)
	channel.RequireMFA = req.RequireMFA
	channel.AllowPassword = req.AllowPassword
	channel.AllowSSO = req.AllowSSO
	channel.TrustedDeviceTTLHours = req.TrustedDeviceTTLHours
	channel.SessionTTLMinutes = req.SessionTTLMinutes
	channel.Active = req.Active
	normalizeLoginChannel(channel)
	if err := uc.repo.Save(context.Background(), channel); err != nil {
		return nil, err
	}
	resp := loginChannelToResponse(channel)
	return &resp, nil
}

func (uc *LoginChannelUsecase) Delete(id uint) error {
	return uc.repo.Delete(context.Background(), id)
}

func (uc *LoginChannelUsecase) findByID(id uint) (*domain.LoginChannel, error) {
	channels, _, err := uc.repo.List(context.Background(), map[string]interface{}{"page": 1, "page_size": 500})
	if err != nil {
		return nil, err
	}
	for _, channel := range channels {
		if channel.ID == id {
			return channel, nil
		}
	}
	return nil, errors.New("login channel không tồn tại")
}

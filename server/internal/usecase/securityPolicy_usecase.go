package usecase

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/owner/auth-server/internal/domain"
)

type SecurityPolicyRulePayload struct {
	RequireStepUp         *bool `json:"require_step_up,omitempty"`
	RequireMFA            *bool `json:"require_mfa,omitempty"`
	AllowPassword         *bool `json:"allow_password,omitempty"`
	AllowSSO              *bool `json:"allow_sso,omitempty"`
	TrustedDeviceTTLHours *int  `json:"trusted_device_ttl_hours,omitempty"`
	SessionTTLMinutes     *int  `json:"session_ttl_minutes,omitempty"`
	RefreshTTLMinutes     *int  `json:"refresh_ttl_minutes,omitempty"`
	StepUpTTLMinutes      *int  `json:"step_up_ttl_minutes,omitempty"`
	LoginIPMaxAttempts    *int  `json:"login_ip_max_attempts,omitempty"`
	LoginIPWindowMinutes  *int  `json:"login_ip_window_minutes,omitempty"`
	LoginIPBlockMinutes   *int  `json:"login_ip_block_minutes,omitempty"`
	LoginIDMaxAttempts    *int  `json:"login_identity_max_attempts,omitempty"`
	LoginIDWindowMinutes  *int  `json:"login_identity_window_minutes,omitempty"`
	LoginIDBlockMinutes   *int  `json:"login_identity_block_minutes,omitempty"`
	PasswordMinLength     *int  `json:"password_min_length,omitempty"`
	RequireUpper          *bool `json:"require_upper,omitempty"`
	RequireLower          *bool `json:"require_lower,omitempty"`
	RequireNumber         *bool `json:"require_number,omitempty"`
	RequireSpecial        *bool `json:"require_special,omitempty"`
}

type CreateSecurityPolicyReq struct {
	Code          string                    `json:"code" binding:"required"`
	Name          string                    `json:"name" binding:"required"`
	Description   string                    `json:"description"`
	PolicyType    string                    `json:"policy_type"`
	ScopeType     string                    `json:"scope_type"`
	TargetClient  string                    `json:"target_client"`
	TargetChannel string                    `json:"target_channel"`
	TargetAction  string                    `json:"target_action"`
	Priority      int                       `json:"priority"`
	Active        bool                      `json:"active"`
	Config        SecurityPolicyRulePayload `json:"config"`
}

type UpdateSecurityPolicyReq = CreateSecurityPolicyReq

type SecurityPolicyResponse struct {
	ID            uint                      `json:"id"`
	Code          string                    `json:"code"`
	Name          string                    `json:"name"`
	Description   string                    `json:"description"`
	PolicyType    string                    `json:"policy_type"`
	ScopeType     string                    `json:"scope_type"`
	TargetClient  string                    `json:"target_client"`
	TargetChannel string                    `json:"target_channel"`
	TargetAction  string                    `json:"target_action"`
	Priority      int                       `json:"priority"`
	Active        bool                      `json:"active"`
	Config        SecurityPolicyRulePayload `json:"config"`
	ConfigJSON    string                    `json:"config_json"`
	CreatedAt     time.Time                 `json:"created_at"`
}

type SecurityPolicyUsecase struct {
	repo domain.SecurityPolicyRepository
}

func NewSecurityPolicyUsecase(repo domain.SecurityPolicyRepository) *SecurityPolicyUsecase {
	return &SecurityPolicyUsecase{repo: repo}
}

func (uc *SecurityPolicyUsecase) List(filters map[string]interface{}, page, pageSize int) (*PaginatedResult[SecurityPolicyResponse], error) {
	filters["page"] = page
	filters["page_size"] = pageSize
	items, total, err := uc.repo.List(context.Background(), filters)
	if err != nil {
		return nil, err
	}
	data := make([]SecurityPolicyResponse, len(items))
	for i, item := range items {
		data[i] = securityPolicyToResponse(item)
	}
	return paginate(data, total, page, pageSize), nil
}

func (uc *SecurityPolicyUsecase) GetByID(id uint) (*SecurityPolicyResponse, error) {
	item, err := uc.findByID(id)
	if err != nil {
		return nil, err
	}
	resp := securityPolicyToResponse(item)
	return &resp, nil
}

func (uc *SecurityPolicyUsecase) Create(req *CreateSecurityPolicyReq) (*SecurityPolicyResponse, error) {
	configJSON, err := policyPayloadToJSON(req.Config)
	if err != nil {
		return nil, err
	}
	policy := &domain.SecurityPolicy{
		Code:          strings.TrimSpace(req.Code),
		Name:          strings.TrimSpace(req.Name),
		Description:   strings.TrimSpace(req.Description),
		PolicyType:    strings.TrimSpace(req.PolicyType),
		ScopeType:     strings.TrimSpace(req.ScopeType),
		TargetClient:  strings.TrimSpace(req.TargetClient),
		TargetChannel: strings.TrimSpace(req.TargetChannel),
		TargetAction:  strings.TrimSpace(req.TargetAction),
		Priority:      req.Priority,
		Active:        req.Active,
		ConfigJSON:    configJSON,
	}
	normalizeSecurityPolicy(policy)
	if err := validateSecurityPolicyDefinition(policy); err != nil {
		return nil, err
	}
	if err := uc.repo.Save(context.Background(), policy); err != nil {
		return nil, err
	}
	resp := securityPolicyToResponse(policy)
	return &resp, nil
}

func (uc *SecurityPolicyUsecase) Update(id uint, req *UpdateSecurityPolicyReq) (*SecurityPolicyResponse, error) {
	policy, err := uc.findByID(id)
	if err != nil {
		return nil, err
	}
	configJSON, err := policyPayloadToJSON(req.Config)
	if err != nil {
		return nil, err
	}
	policy.Code = strings.TrimSpace(req.Code)
	policy.Name = strings.TrimSpace(req.Name)
	policy.Description = strings.TrimSpace(req.Description)
	policy.PolicyType = strings.TrimSpace(req.PolicyType)
	policy.ScopeType = strings.TrimSpace(req.ScopeType)
	policy.TargetClient = strings.TrimSpace(req.TargetClient)
	policy.TargetChannel = strings.TrimSpace(req.TargetChannel)
	policy.TargetAction = strings.TrimSpace(req.TargetAction)
	policy.Priority = req.Priority
	policy.Active = req.Active
	policy.ConfigJSON = configJSON
	normalizeSecurityPolicy(policy)
	if err := validateSecurityPolicyDefinition(policy); err != nil {
		return nil, err
	}
	if err := uc.repo.Save(context.Background(), policy); err != nil {
		return nil, err
	}
	resp := securityPolicyToResponse(policy)
	return &resp, nil
}

func (uc *SecurityPolicyUsecase) Delete(id uint) error {
	return uc.repo.Delete(context.Background(), id)
}

func (uc *SecurityPolicyUsecase) findByID(id uint) (*domain.SecurityPolicy, error) {
	items, _, err := uc.repo.List(context.Background(), map[string]interface{}{"page": 1, "page_size": 500})
	if err != nil {
		return nil, err
	}
	for _, item := range items {
		if item.ID == id {
			return item, nil
		}
	}
	return nil, errors.New("security policy không tồn tại")
}

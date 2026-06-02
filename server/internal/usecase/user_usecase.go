package usecase

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/owner/auth-server/internal/domain"
	passwordsvc "github.com/owner/auth-server/internal/security/password"
)

// ─── User Usecase ─────────────────────────────────────────────────────────────

type CreateUserReq struct {
	Username          string     `json:"username" binding:"required,min=3"`
	Password          string     `json:"password" binding:"required,min=6"`
	FullName          string     `json:"full_name" binding:"required"`
	Email             string     `json:"email" binding:"required,email"`
	Phone             string     `json:"phone"`
	Status            string     `json:"status"`
	RoleIDs           []uint     `json:"role_ids"`
	PasswordExpiresAt *time.Time `json:"password_expires_at"`
	OneTimePassword   bool       `json:"one_time_password"`
	RequireOTP        bool       `json:"require_otp"`
	TwoFactorEnabled  bool       `json:"two_factor_enabled"`
	AllowedClients    []string   `json:"allowed_clients"`
	AllowedChannels   []string   `json:"allowed_channels"`
}

type UpdateUserReq struct {
	FullName          string     `json:"full_name"`
	Email             string     `json:"email"`
	Phone             string     `json:"phone"`
	Status            string     `json:"status"`
	RoleIDs           []uint     `json:"role_ids"`
	PasswordExpiresAt *time.Time `json:"password_expires_at"`
	OneTimePassword   bool       `json:"one_time_password"`
	RequireOTP        bool       `json:"require_otp"`
	TwoFactorEnabled  bool       `json:"two_factor_enabled"`
	AllowedClients    []string   `json:"allowed_clients"`
	AllowedChannels   []string   `json:"allowed_channels"`
}

type UserResponse struct {
	ID                uint       `json:"id"`
	Username          string     `json:"username"`
	FullName          string     `json:"full_name"`
	Email             string     `json:"email"`
	EmailVerified     bool       `json:"email_verified"`
	Phone             string     `json:"phone"`
	Status            string     `json:"status"`
	Roles             []string   `json:"roles"`
	RoleIDs           []uint     `json:"role_ids"`
	PasswordExpiresAt *time.Time `json:"password_expires_at,omitempty"`
	OneTimePassword   bool       `json:"one_time_password"`
	RequireOTP        bool       `json:"require_otp"`
	TwoFactorEnabled  bool       `json:"two_factor_enabled"`
	AllowedClients    []string   `json:"allowed_clients"`
	AllowedChannels   []string   `json:"allowed_channels"`
}

type PaginatedResult[T any] struct {
	Data       []T   `json:"data"`
	Total      int64 `json:"total"`
	Page       int   `json:"page"`
	PageSize   int   `json:"page_size"`
	TotalPages int   `json:"total_pages"`
}

type UserUsecase struct {
	repo       domain.UserRepository
	tokenRepo  domain.TokenRepository
	policyRepo domain.SecurityPolicyRepository
}

func NewUserUsecase(repo domain.UserRepository, tokenRepo domain.TokenRepository, policyRepo domain.SecurityPolicyRepository) *UserUsecase {
	return &UserUsecase{repo: repo, tokenRepo: tokenRepo, policyRepo: policyRepo}
}

func (uc *UserUsecase) List(spec interface{}, page, pageSize int) (*PaginatedResult[UserResponse], error) {
	users, total, err := uc.repo.List(context.Background(), spec)
	if err != nil {
		return nil, err
	}
	data := make([]UserResponse, len(users))
	for i, u := range users {
		data[i] = userToResponse(u)
	}
	return paginate(data, total, page, pageSize), nil
}

func (uc *UserUsecase) GetByID(id uint) (*UserResponse, error) {
	u, err := uc.repo.FindByID(context.Background(), id)
	if err != nil {
		return nil, errors.New("người dùng không tồn tại")
	}
	r := userToResponse(u)
	return &r, nil
}

func (uc *UserUsecase) Create(req *CreateUserReq) (*UserResponse, error) {
	u := &domain.User{
		Username:          req.Username,
		FullName:          req.FullName,
		Email:             req.Email,
		Phone:             req.Phone,
		Status:            req.Status,
		PasswordExpiresAt: req.PasswordExpiresAt,
		OneTimePassword:   req.OneTimePassword,
		RequireOTP:        req.RequireOTP,
		TwoFactorEnabled:  req.TwoFactorEnabled,
		AllowedClients:    req.AllowedClients,
		AllowedChannels:   req.AllowedChannels,
	}
	if err := validatePasswordPolicy(u, req.Password, uc.resolvePasswordPolicy("")); err != nil {
		return nil, err
	}
	hash, err := passwordsvc.Hash(req.Password)
	if err != nil {
		return nil, err
	}
	status := req.Status
	if status == "" {
		status = "active"
	}
	u.PasswordHash = string(hash)
	u.Status = status
	u.PasswordHistory = appendPasswordHistory(nil, u.PasswordHash)
	if err = uc.repo.Save(context.Background(), u); err != nil {
		return nil, fmt.Errorf("tạo người dùng thất bại: %w", err)
	}
	if len(req.RoleIDs) > 0 {
		_ = uc.repo.SetRoles(context.Background(), u.ID, req.RoleIDs)
	}
	fresh, err := uc.repo.FindByID(context.Background(), u.ID)
	if err != nil {
		return nil, fmt.Errorf("không thể lấy thông tin người dùng mới: %w", err)
	}
	r := userToResponse(fresh)
	return &r, nil
}

func (uc *UserUsecase) Update(id uint, req *UpdateUserReq) (*UserResponse, error) {
	u, err := uc.repo.FindByID(context.Background(), id)
	if err != nil {
		return nil, errors.New("người dùng không tồn tại")
	}
	if req.FullName != "" {
		u.FullName = req.FullName
	}
	if req.Email != "" {
		if !strings.EqualFold(u.Email, req.Email) {
			u.EmailVerified = false
		}
		u.Email = req.Email
	}
	if req.Phone != "" {
		u.Phone = req.Phone
	}
	if req.Status != "" {
		u.Status = req.Status
	}
	u.PasswordExpiresAt = req.PasswordExpiresAt
	u.OneTimePassword = req.OneTimePassword
	u.RequireOTP = req.RequireOTP
	u.TwoFactorEnabled = req.TwoFactorEnabled
	if !req.TwoFactorEnabled {
		u.TOTPSecret = ""
		u.PendingTOTPSecret = ""
	}
	if req.AllowedClients != nil {
		u.AllowedClients = req.AllowedClients
	}
	if req.AllowedChannels != nil {
		u.AllowedChannels = req.AllowedChannels
	}
	if err = uc.repo.Save(context.Background(), u); err != nil {
		return nil, err
	}
	if req.RoleIDs != nil {
		_ = uc.repo.SetRoles(context.Background(), id, req.RoleIDs)
	}
	fresh, err := uc.repo.FindByID(context.Background(), id)
	if err != nil {
		return nil, fmt.Errorf("không thể lấy thông tin người dùng cập nhật: %w", err)
	}
	r := userToResponse(fresh)
	return &r, nil
}

func (uc *UserUsecase) Delete(id uint) error {
	return uc.repo.Delete(context.Background(), id)
}

func (uc *UserUsecase) ResetPassword(id uint, newPassword string, oneTimePassword bool) error {
	u, err := uc.repo.FindByID(context.Background(), id)
	if err != nil {
		return errors.New("người dùng không tồn tại")
	}
	if err := validatePasswordPolicy(u, newPassword, uc.resolvePasswordPolicy("")); err != nil {
		return err
	}
	hash, _ := passwordsvc.Hash(newPassword)
	u.PasswordHash = string(hash)
	u.PasswordHistory = appendPasswordHistory(u.PasswordHistory, u.PasswordHash)
	u.OneTimePassword = oneTimePassword
	u.FailedLogins = 0
	u.LockedUntil = nil
	if oneTimePassword {
		u.PasswordExpiresAt = nil
	}
	if err := uc.repo.Save(context.Background(), u); err != nil {
		return err
	}
	if uc.tokenRepo != nil {
		return uc.tokenRepo.RevokeByUserID(context.Background(), id)
	}
	return nil
}

func (uc *UserUsecase) resolvePasswordPolicy(clientID string) *securityPolicyConfig {
	return resolvePolicyConfig(context.Background(), uc.policyRepo, "password", clientID, "")
}

func userToResponse(u *domain.User) UserResponse {
	roles := make([]string, 0)
	ids := make([]uint, 0)
	for _, r := range u.Roles {
		roles = append(roles, r.Name)
		ids = append(ids, r.ID)
	}
	return UserResponse{
		ID: u.ID, Username: u.Username, FullName: u.FullName,
		Email: u.Email, EmailVerified: u.EmailVerified, Phone: u.Phone, Status: u.Status,
		Roles: roles, RoleIDs: ids,
		PasswordExpiresAt: u.PasswordExpiresAt,
		OneTimePassword:   u.OneTimePassword,
		RequireOTP:        u.RequireOTP,
		TwoFactorEnabled:  u.TwoFactorEnabled,
		AllowedClients:    u.AllowedClients,
		AllowedChannels:   u.AllowedChannels,
	}
}

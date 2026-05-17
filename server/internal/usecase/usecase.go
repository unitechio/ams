package usecase

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"time"
	"unicode"

	"github.com/owner/auth-server/internal/authorization/permission"
	"github.com/owner/auth-server/internal/domain"
	jwtpkg "github.com/owner/auth-server/internal/jwt"
	"golang.org/x/crypto/bcrypt"
)

var (
	mockResetTokens = struct {
		sync.RWMutex
		m map[string]uint
	}{m: make(map[string]uint)}
	mockVerifyTokens = struct {
		sync.RWMutex
		m map[string]uint
	}{m: make(map[string]uint)}
)

const maxFailedLogins = 5
const passwordHistoryLimit = 5

var (
	ErrInvalidCredentials = errors.New("sai tên đăng nhập hoặc mật khẩu")
	ErrAccountLocked      = errors.New("tài khoản bị khóa tạm thời, vui lòng thử lại sau 30 phút")
	ErrAccountInactive    = errors.New("tài khoản không hoạt động")
	ErrTokenRevoked       = errors.New("phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại")
)

// ─── DTOs (shared across usecases) ───────────────────────────────────────────

type LoginRequest struct {
	Username  string `json:"username" binding:"required,min=3"`
	Password  string `json:"password" binding:"required,min=6"`
	IPAddress string `json:"-"`
	UserAgent string `json:"-"`
}

type LoginResponse struct {
	AccessToken          string   `json:"access_token"`
	RefreshToken         string   `json:"refresh_token"`
	User                 UserInfo `json:"user"`
	MustChangePassword   bool     `json:"must_change_password"`
	PasswordExpired      bool     `json:"password_expired"`
	PasswordChangeReason string   `json:"password_change_reason,omitempty"`
}

type UserInfo struct {
	ID                uint       `json:"id"`
	Username          string     `json:"username"`
	FullName          string     `json:"full_name"`
	Email             string     `json:"email"`
	Phone             string     `json:"phone"`
	Status            string     `json:"status"`
	Roles             []string   `json:"roles"`
	Permissions       []string   `json:"permissions"`
	PasswordExpiresAt *time.Time `json:"password_expires_at,omitempty"`
	OneTimePassword   bool       `json:"one_time_password"`
	RequireOTP        bool       `json:"require_otp"`
	TwoFactorEnabled  bool       `json:"two_factor_enabled"`
}

// ─── Auth Usecase ─────────────────────────────────────────────────────────────

type AuthUsecase struct {
	userRepo  domain.UserRepository
	tokenRepo domain.TokenRepository
	permRepo  domain.PermissionRepository
	authRepo  domain.AuthHistoryRepository
	jwt       *jwtpkg.Service
}

func NewAuthUsecase(
	userRepo domain.UserRepository,
	tokenRepo domain.TokenRepository,
	permRepo domain.PermissionRepository,
	authRepo domain.AuthHistoryRepository,
	jwt *jwtpkg.Service,
) *AuthUsecase {
	return &AuthUsecase{userRepo, tokenRepo, permRepo, authRepo, jwt}
}

func (uc *AuthUsecase) Login(req *LoginRequest) (*LoginResponse, error) {
	user, err := uc.userRepo.FindByUsername(req.Username)
	if err != nil {
		uc.recordLoginHistory(0, req.Username, req.IPAddress, req.UserAgent, "failed", "Người dùng không tồn tại")
		return nil, ErrInvalidCredentials
	}
	if user.Status == "inactive" {
		uc.recordLoginHistory(user.ID, req.Username, req.IPAddress, req.UserAgent, "failed", "Tài khoản bị vô hiệu hóa")
		return nil, ErrAccountInactive
	}
	if user.Status == "locked" && user.LockedUntil != nil && user.LockedUntil.Before(time.Now()) {
		user.Status = "active"
		user.LockedUntil = nil
		user.FailedLogins = 0
		_ = uc.userRepo.Save(user)
	}
	if user.IsLocked() {
		uc.recordLoginHistory(user.ID, req.Username, req.IPAddress, req.UserAgent, "locked", "Tài khoản đang bị khóa")
		return nil, ErrAccountLocked
	}
	if err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		failed := user.FailedLogins + 1
		var lockUntil *time.Time
		note := "Sai mật khẩu"
		if failed >= maxFailedLogins {
			t := time.Now().Add(30 * time.Minute)
			lockUntil = &t
			note = "Sai mật khẩu quá nhiều lần - Khóa tài khoản"
		}
		uc.userRepo.UpdateFailedLogin(user.ID, failed, lockUntil)
		uc.recordLoginHistory(user.ID, req.Username, req.IPAddress, req.UserAgent, "failed", note)
		if lockUntil != nil {
			return nil, ErrAccountLocked
		}
		return nil, ErrInvalidCredentials
	}
	uc.userRepo.UpdateLastLogin(user.ID)
	uc.recordLoginHistory(user.ID, req.Username, req.IPAddress, req.UserAgent, "success", "")
	return uc.buildLoginResponse(user)
}

func (uc *AuthUsecase) recordLoginHistory(userID uint, username, ip, ua, status, note string) {
	_ = uc.authRepo.Save(&domain.AuthHistory{
		UserID:    userID,
		Username:  username,
		IPAddress: ip,
		UserAgent: ua,
		Status:    status,
		Note:      note,
	})
}

func (uc *AuthUsecase) RefreshToken(refreshTokenStr string) (*LoginResponse, error) {
	claims, err := uc.jwt.ValidateToken(refreshTokenStr)
	if err != nil {
		return nil, ErrTokenRevoked
	}
	stored, err := uc.tokenRepo.FindByToken(refreshTokenStr)
	if err != nil || stored.ExpiresAt.Before(time.Now()) {
		return nil, ErrTokenRevoked
	}
	uc.tokenRepo.RevokeToken(refreshTokenStr)

	user, err := uc.userRepo.FindByID(claims.UserID)
	if err != nil {
		return nil, ErrTokenRevoked
	}
	return uc.buildLoginResponse(user)
}

func (uc *AuthUsecase) Logout(userID uint) error {
	return uc.tokenRepo.RevokeByUserID(userID)
}

func (uc *AuthUsecase) Me(userID uint) (*UserInfo, error) {
	user, err := uc.userRepo.FindByID(userID)
	if err != nil {
		return nil, err
	}
	ps := user.EffectivePermissions()
	return &UserInfo{
		ID:                user.ID,
		Username:          user.Username,
		FullName:          user.FullName,
		Email:             user.Email,
		Phone:             user.Phone,
		Status:            user.Status,
		Roles:             roleNames(user),
		Permissions:       ps.List(),
		PasswordExpiresAt: user.PasswordExpiresAt,
		OneTimePassword:   user.OneTimePassword,
		RequireOTP:        user.RequireOTP,
		TwoFactorEnabled:  user.TwoFactorEnabled,
	}, nil
}

func (uc *AuthUsecase) ChangePassword(userID uint, oldPw, newPw string) error {
	user, err := uc.userRepo.FindByID(userID)
	if err != nil {
		return errors.New("người dùng không tồn tại")
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(oldPw)) != nil {
		return errors.New("mật khẩu cũ không đúng")
	}
	if err := validatePasswordPolicy(user, newPw); err != nil {
		return err
	}
	hash, _ := bcrypt.GenerateFromPassword([]byte(newPw), bcrypt.DefaultCost)
	user.PasswordHash = string(hash)
	user.PasswordHistory = appendPasswordHistory(user.PasswordHistory, user.PasswordHash)
	user.OneTimePassword = false
	if user.PasswordExpiresAt != nil && !user.PasswordExpiresAt.After(time.Now()) {
		user.PasswordExpiresAt = nil
	}
	uc.tokenRepo.RevokeByUserID(userID)
	return uc.userRepo.Save(user)
}

func (uc *AuthUsecase) buildLoginResponse(user *domain.User) (*LoginResponse, error) {
	ps := user.EffectivePermissions()
	roles := roleNames(user)
	passwordExpired := user.PasswordExpiresAt != nil && !user.PasswordExpiresAt.After(time.Now())
	mustChangePassword := user.OneTimePassword || passwordExpired
	passwordChangeReason := ""
	if user.OneTimePassword {
		passwordChangeReason = "one_time_password"
	} else if passwordExpired {
		passwordChangeReason = "password_expired"
	}

	accessToken, err := uc.jwt.GenerateAccessToken(user.ID, user.Username, roles)
	if err != nil {
		return nil, err
	}
	refreshStr, expiry, err := uc.jwt.GenerateRefreshToken(user.ID, user.Username)
	if err != nil {
		return nil, err
	}
	uc.tokenRepo.Save(&domain.RefreshToken{UserID: user.ID, Token: refreshStr, ExpiresAt: expiry})

	return &LoginResponse{
		AccessToken:          accessToken,
		RefreshToken:         refreshStr,
		MustChangePassword:   mustChangePassword,
		PasswordExpired:      passwordExpired,
		PasswordChangeReason: passwordChangeReason,
		User: UserInfo{
			ID:                user.ID,
			Username:          user.Username,
			FullName:          user.FullName,
			Email:             user.Email,
			Phone:             user.Phone,
			Status:            user.Status,
			Roles:             roles,
			Permissions:       ps.List(),
			PasswordExpiresAt: user.PasswordExpiresAt,
			OneTimePassword:   user.OneTimePassword,
			RequireOTP:        user.RequireOTP,
			TwoFactorEnabled:  user.TwoFactorEnabled,
		},
	}, nil
}

type SessionResponse struct {
	ID         string `json:"id"`
	Device     string `json:"device"`
	IP         string `json:"ip"`
	Location   string `json:"location"`
	LastActive string `json:"last_active"`
	IsCurrent  bool   `json:"is_current"`
}

type Setup2FAResponse struct {
	Secret    string `json:"secret"`
	QRCodeURL string `json:"qr_code_url"`
}

func (uc *AuthUsecase) ListSessions(userID uint) ([]SessionResponse, error) {
	return []SessionResponse{
		{ID: "sess-1", Device: "Chrome on Windows", IP: "192.168.1.10", Location: "Hanoi, VN", LastActive: "Vừa xong", IsCurrent: true},
		{ID: "sess-2", Device: "Safari on iPhone", IP: "14.232.11.2", Location: "HCMC, VN", LastActive: "2 giờ trước", IsCurrent: false},
	}, nil
}

func (uc *AuthUsecase) RevokeSession(userID uint, sessionID string) error {
	return nil
}

func (uc *AuthUsecase) RevokeAllSessions(userID uint) error {
	return uc.Logout(userID)
}

func (uc *AuthUsecase) Setup2FA(userID uint) (*Setup2FAResponse, error) {
	return &Setup2FAResponse{
		Secret:    "JBSWY3DPEHPK3PXP",
		QRCodeURL: "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=otpauth://totp/Admin%3Aadmin%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Admin",
	}, nil
}

func (uc *AuthUsecase) Verify2FA(userID uint, code string) error {
	if len(code) != 6 {
		return errors.New("mã OTP không hợp lệ")
	}
	user, err := uc.userRepo.FindByID(userID)
	if err == nil {
		user.TwoFactorEnabled = true
		uc.userRepo.Save(user)
	}
	return nil
}

func (uc *AuthUsecase) Disable2FA(userID uint) error {
	user, err := uc.userRepo.FindByID(userID)
	if err == nil {
		user.TwoFactorEnabled = false
		uc.userRepo.Save(user)
	}
	return nil
}

func (uc *AuthUsecase) ForgotPassword(email string) error {
	user, err := uc.userRepo.FindByEmail(email)
	if err != nil {
		// Don't leak user existence
		return nil
	}

	b := make([]byte, 16)
	rand.Read(b)
	token := hex.EncodeToString(b)

	mockResetTokens.Lock()
	mockResetTokens.m[token] = user.ID
	mockResetTokens.Unlock()

	// In ra log console (mô phỏng việc gửi email thực tế)
	fmt.Printf("\n=======================================================\n")
	fmt.Printf("📧 [MOCK EMAIL] YÊU CẦU KHÔI PHỤC MẬT KHẨU\n")
	fmt.Printf("   Gửi tới: %s\n", email)
	fmt.Printf("   Token khôi phục: %s\n", token)
	fmt.Printf("   (Sao chép mã này vào trang web để đổi mật khẩu)\n")
	fmt.Printf("=======================================================\n\n")

	return nil
}

func (uc *AuthUsecase) ResetPasswordWithToken(token string, newPassword string) error {
	mockResetTokens.RLock()
	userID, ok := mockResetTokens.m[token]
	mockResetTokens.RUnlock()

	if !ok {
		return errors.New("token không hợp lệ hoặc đã hết hạn")
	}

	user, err := uc.userRepo.FindByID(userID)
	if err != nil {
		return errors.New("người dùng không tồn tại")
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	user.PasswordHash = string(hash)

	if err := uc.userRepo.Save(user); err != nil {
		return err
	}

	// Remove token after use
	mockResetTokens.Lock()
	delete(mockResetTokens.m, token)
	mockResetTokens.Unlock()

	// Revoke all existing sessions
	uc.tokenRepo.RevokeByUserID(user.ID)
	return nil
}

func (uc *AuthUsecase) SendVerificationEmail(userID uint) error {
	user, err := uc.userRepo.FindByID(userID)
	if err != nil {
		return errors.New("người dùng không tồn tại")
	}

	// Generate a 6-digit OTP
	otp := fmt.Sprintf("%06d", time.Now().UnixNano()%1000000)

	mockVerifyTokens.Lock()
	mockVerifyTokens.m[otp] = user.ID
	mockVerifyTokens.Unlock()

	fmt.Printf("\n=======================================================\n")
	fmt.Printf("📧 [MOCK EMAIL] XÁC MINH TÀI KHOẢN EMAIL\n")
	fmt.Printf("   Gửi tới: %s\n", user.Email)
	fmt.Printf("   Mã OTP xác minh của bạn là: %s\n", otp)
	fmt.Printf("   (Nhập mã OTP này trên giao diện web để kích hoạt)\n")
	fmt.Printf("=======================================================\n\n")

	return nil
}

func (uc *AuthUsecase) VerifyEmail(token string) error {
	mockVerifyTokens.RLock()
	userID, ok := mockVerifyTokens.m[token]
	mockVerifyTokens.RUnlock()

	if !ok {
		return errors.New("mã OTP không hợp lệ hoặc đã hết hạn")
	}

	user, err := uc.userRepo.FindByID(userID)
	if err != nil {
		return errors.New("người dùng không tồn tại")
	}

	// Set user status to active (or mark email as verified)
	user.Status = "active"

	if err := uc.userRepo.Save(user); err != nil {
		return err
	}

	mockVerifyTokens.Lock()
	delete(mockVerifyTokens.m, token)
	mockVerifyTokens.Unlock()

	return nil
}

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
}

type UserResponse struct {
	ID                uint       `json:"id"`
	Username          string     `json:"username"`
	FullName          string     `json:"full_name"`
	Email             string     `json:"email"`
	Phone             string     `json:"phone"`
	Status            string     `json:"status"`
	Roles             []string   `json:"roles"`
	RoleIDs           []uint     `json:"role_ids"`
	PasswordExpiresAt *time.Time `json:"password_expires_at,omitempty"`
	OneTimePassword   bool       `json:"one_time_password"`
	RequireOTP        bool       `json:"require_otp"`
	TwoFactorEnabled  bool       `json:"two_factor_enabled"`
}

type PaginatedResult[T any] struct {
	Data       []T   `json:"data"`
	Total      int64 `json:"total"`
	Page       int   `json:"page"`
	PageSize   int   `json:"page_size"`
	TotalPages int   `json:"total_pages"`
}

type UserUsecase struct {
	repo      domain.UserRepository
	tokenRepo domain.TokenRepository
}

func NewUserUsecase(repo domain.UserRepository, tokenRepo domain.TokenRepository) *UserUsecase {
	return &UserUsecase{repo: repo, tokenRepo: tokenRepo}
}

func (uc *UserUsecase) List(spec interface{}, page, pageSize int) (*PaginatedResult[UserResponse], error) {
	users, total, err := uc.repo.List(spec)
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
	u, err := uc.repo.FindByID(id)
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
	}
	if err := validatePasswordPolicy(u, req.Password); err != nil {
		return nil, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
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
	if err = uc.repo.Save(u); err != nil {
		return nil, fmt.Errorf("tạo người dùng thất bại: %w", err)
	}
	if len(req.RoleIDs) > 0 {
		uc.repo.SetRoles(u.ID, req.RoleIDs)
	}
	fresh, err := uc.repo.FindByID(u.ID)
	if err != nil {
		return nil, fmt.Errorf("không thể lấy thông tin người dùng mới: %w", err)
	}
	r := userToResponse(fresh)
	return &r, nil
}

func (uc *UserUsecase) Update(id uint, req *UpdateUserReq) (*UserResponse, error) {
	u, err := uc.repo.FindByID(id)
	if err != nil {
		return nil, errors.New("người dùng không tồn tại")
	}
	if req.FullName != "" {
		u.FullName = req.FullName
	}
	if req.Email != "" {
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
	if err = uc.repo.Save(u); err != nil {
		return nil, err
	}
	if req.RoleIDs != nil {
		uc.repo.SetRoles(id, req.RoleIDs)
	}
	fresh, err := uc.repo.FindByID(id)
	if err != nil {
		return nil, fmt.Errorf("không thể lấy thông tin người dùng cập nhật: %w", err)
	}
	r := userToResponse(fresh)
	return &r, nil
}

func (uc *UserUsecase) Delete(id uint) error { return uc.repo.Delete(id) }

func (uc *UserUsecase) ResetPassword(id uint, newPassword string, oneTimePassword bool) error {
	u, err := uc.repo.FindByID(id)
	if err != nil {
		return errors.New("người dùng không tồn tại")
	}
	if err := validatePasswordPolicy(u, newPassword); err != nil {
		return err
	}
	hash, _ := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	u.PasswordHash = string(hash)
	u.PasswordHistory = appendPasswordHistory(u.PasswordHistory, u.PasswordHash)
	u.OneTimePassword = oneTimePassword
	u.FailedLogins = 0
	u.LockedUntil = nil
	if oneTimePassword {
		u.PasswordExpiresAt = nil
	}
	if err := uc.repo.Save(u); err != nil {
		return err
	}
	if uc.tokenRepo != nil {
		return uc.tokenRepo.RevokeByUserID(id)
	}
	return nil
}

// ─── Role Usecase ─────────────────────────────────────────────────────────────

type CreateRoleReq struct {
	Name        string `json:"name" binding:"required,min=2"`
	Description string `json:"description"`
}

type UpdateRoleReq struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type AssignPermReq struct {
	Permissions []struct {
		Code  string `json:"code"`
		Scope string `json:"scope"`
	} `json:"permissions" binding:"required"`
}

type RoleResponse struct {
	ID              uint     `json:"id"`
	Name            string   `json:"name"`
	Description     string   `json:"description"`
	UserCount       int64    `json:"user_count"`
	PermissionCodes []string `json:"permission_codes"`
	Scopes          []string `json:"scopes"`
}

type RoleUsecase struct{ repo domain.RoleRepository }

func NewRoleUsecase(repo domain.RoleRepository) *RoleUsecase { return &RoleUsecase{repo} }

func (uc *RoleUsecase) List(spec interface{}, page, pageSize int) (*PaginatedResult[RoleResponse], error) {
	roles, total, err := uc.repo.List(spec)
	if err != nil {
		return nil, err
	}
	data := make([]RoleResponse, len(roles))
	for i, r := range roles {
		data[i] = roleToResponse(r, uc.repo.GetUserCount(r.ID))
	}
	return paginate(data, total, page, pageSize), nil
}

func (uc *RoleUsecase) GetByID(id uint) (*RoleResponse, error) {
	r, err := uc.repo.FindByID(id)
	if err != nil {
		return nil, errors.New("vai trò không tồn tại")
	}
	resp := roleToResponse(r, uc.repo.GetUserCount(r.ID))
	return &resp, nil
}

func (uc *RoleUsecase) Create(req *CreateRoleReq, by string) (*RoleResponse, error) {
	role := &domain.Role{Name: req.Name, Description: req.Description, CreatedBy: by, CreatedAt: time.Now()}
	if err := uc.repo.Save(role); err != nil {
		return nil, err
	}
	resp := roleToResponse(role, 0)
	return &resp, nil
}

func (uc *RoleUsecase) Update(id uint, req *UpdateRoleReq) (*RoleResponse, error) {
	role, err := uc.repo.FindByID(id)
	if err != nil {
		return nil, errors.New("vai trò không tồn tại")
	}
	if req.Name != "" {
		role.Name = req.Name
	}
	if req.Description != "" {
		role.Description = req.Description
	}
	if err = uc.repo.Save(role); err != nil {
		return nil, err
	}
	resp := roleToResponse(role, uc.repo.GetUserCount(id))
	return &resp, nil
}

func (uc *RoleUsecase) Delete(id uint) error { return uc.repo.Delete(id) }

func (uc *RoleUsecase) AssignPermissions(id uint, req *AssignPermReq) error {
	perms := make([]domain.RolePermission, len(req.Permissions))
	for i, p := range req.Permissions {
		scope := permission.Scope(p.Scope)
		if scope == "" {
			scope = permission.ScopeSelf
		}
		perms[i] = domain.RolePermission{Code: permission.Permission(p.Code), Scope: scope}
	}
	return uc.repo.AssignPermissions(id, perms)
}

// ─── Permission Usecase ───────────────────────────────────────────────────────

type PermissionResponse struct {
	ID          uint                     `json:"id"`
	Code        string                   `json:"code"`
	Name        string                   `json:"name"`
	Description string                   `json:"description"`
	GroupName   string                   `json:"group_name"`
	Lines       []*domain.PermissionLine `json:"lines"`
}

type CreatePermissionReq struct {
	Code        string `json:"code" binding:"required"`
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	GroupName   string `json:"group_name" binding:"required"`
}

type PermissionUsecase struct{ repo domain.PermissionRepository }

func NewPermissionUsecase(repo domain.PermissionRepository) *PermissionUsecase {
	return &PermissionUsecase{repo}
}

func (uc *PermissionUsecase) ListAll() ([]PermissionResponse, error) {
	defs, err := uc.repo.FindAll()
	if err != nil {
		return nil, err
	}
	result := make([]PermissionResponse, len(defs))
	for i, d := range defs {
		lines, _ := uc.repo.GetLines(d.ID)
		result[i] = PermissionResponse{
			ID:          d.ID,
			Code:        string(d.Code),
			Name:        d.Name,
			Description: d.Description,
			GroupName:   d.GroupName,
			Lines:       lines,
		}
	}
	return result, nil
}

func (uc *PermissionUsecase) Create(req *CreatePermissionReq) (*PermissionResponse, error) {
	// Check if already exists
	existing, _ := uc.repo.FindByCode(permission.Permission(req.Code))
	if existing != nil {
		return nil, fmt.Errorf("quyền '%s' đã tồn tại", req.Code)
	}

	p := &domain.PermissionDef{
		Code:        permission.Permission(req.Code),
		Name:        req.Name,
		Description: req.Description,
		GroupName:   req.GroupName,
	}
	if err := uc.repo.Save(p); err != nil {
		return nil, err
	}
	return &PermissionResponse{
		ID:          p.ID,
		Code:        string(p.Code),
		Name:        p.Name,
		Description: p.Description,
		GroupName:   p.GroupName,
		Lines:       []*domain.PermissionLine{},
	}, nil
}

func (uc *PermissionUsecase) AddLine(permCode string, line *domain.PermissionLine, by string) (*domain.PermissionLine, error) {
	def, err := uc.repo.FindByCode(permission.Permission(permCode))
	if err != nil {
		return nil, errors.New("quyền hạn không tồn tại")
	}
	line.PermissionID = def.ID
	line.CreatedBy = by
	if err = uc.repo.AddLine(line); err != nil {
		return nil, err
	}
	return line, nil
}

func (uc *PermissionUsecase) DeleteLine(id uint) error { return uc.repo.DeleteLine(id) }

// ─── Menu Usecase ─────────────────────────────────────────────────────────────

type CreateMenuReq struct {
	Title          string `json:"title" binding:"required"`
	URL            string `json:"url"`
	SortOrder      int    `json:"sort_order"`
	Icon           string `json:"icon"`
	PermissionCode string `json:"permission_code"`
	ParentID       *uint  `json:"parent_id"`
	MenuType       string `json:"menu_type"`
}

type MenuResponse struct {
	ID             uint           `json:"id"`
	Title          string         `json:"title"`
	URL            string         `json:"url"`
	SortOrder      int            `json:"sort_order"`
	Icon           string         `json:"icon"`
	PermissionCode string         `json:"permission_code"`
	ParentID       *uint          `json:"parent_id"`
	MenuType       string         `json:"menu_type"`
	Level          int            `json:"level"`
	Children       []MenuResponse `json:"children,omitempty"`
}

type MenuUsecase struct{ repo domain.MenuRepository }

func NewMenuUsecase(repo domain.MenuRepository) *MenuUsecase { return &MenuUsecase{repo} }

func (uc *MenuUsecase) ListPaginated(spec interface{}, page, pageSize int) (*PaginatedResult[MenuResponse], error) {
	menus, total, err := uc.repo.ListPaginated(spec)
	if err != nil {
		return nil, err
	}
	data := make([]MenuResponse, len(menus))
	for i, m := range menus {
		data[i] = menuToResponse(m)
	}
	return paginate(data, total, page, pageSize), nil
}

func (uc *MenuUsecase) GetFiltered(ps *permission.PermissionSet) ([]MenuResponse, error) {
	all, err := uc.repo.FindAll()
	if err != nil {
		return nil, err
	}
	// Filter by permissions using menubuilder
	allowed := filterMenuByPermission(all, ps)
	result := make([]MenuResponse, len(allowed))
	for i, m := range allowed {
		result[i] = menuToResponse(m)
	}
	return result, nil
}

func (uc *MenuUsecase) Create(req *CreateMenuReq) (*MenuResponse, error) {
	menuType := req.MenuType
	if menuType == "" {
		menuType = "main"
	}
	m := &domain.Menu{
		Title:          req.Title,
		URL:            req.URL,
		SortOrder:      req.SortOrder,
		Icon:           req.Icon,
		PermissionCode: permission.Permission(req.PermissionCode),
		ParentID:       req.ParentID,
		MenuType:       menuType,
	}
	if err := uc.repo.Save(m); err != nil {
		return nil, err
	}
	r := menuToResponse(m)
	return &r, nil
}

func (uc *MenuUsecase) Update(id uint, req *CreateMenuReq) (*MenuResponse, error) {
	m, err := uc.repo.FindByID(id)
	if err != nil {
		return nil, errors.New("menu không tồn tại")
	}
	if req.Title != "" {
		m.Title = req.Title
	}
	m.URL = req.URL
	m.SortOrder = req.SortOrder
	m.Icon = req.Icon
	m.PermissionCode = permission.Permission(req.PermissionCode)
	m.ParentID = req.ParentID
	if err = uc.repo.Save(m); err != nil {
		return nil, err
	}
	r := menuToResponse(m)
	return &r, nil
}

func (uc *MenuUsecase) Delete(id uint) error { return uc.repo.Delete(id) }

// ─── Helpers ──────────────────────────────────────────────────────────────────

func roleNames(u *domain.User) []string {
	names := make([]string, 0, len(u.Roles))
	seen := map[string]bool{}
	for _, r := range u.Roles {
		if !seen[r.Name] {
			names = append(names, r.Name)
			seen[r.Name] = true
		}
	}
	return names
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
		Email: u.Email, Phone: u.Phone, Status: u.Status,
		Roles: roles, RoleIDs: ids,
		PasswordExpiresAt: u.PasswordExpiresAt,
		OneTimePassword:   u.OneTimePassword,
		RequireOTP:        u.RequireOTP,
		TwoFactorEnabled:  u.TwoFactorEnabled,
	}
}

func roleToResponse(r *domain.Role, userCount int64) RoleResponse {
	codes := make([]string, 0, len(r.Permissions))
	scopes := make([]string, 0, len(r.Permissions))
	for _, p := range r.Permissions {
		codes = append(codes, string(p.Code))
		scopes = append(scopes, string(p.Scope))
	}
	return RoleResponse{
		ID: r.ID, Name: r.Name, Description: r.Description,
		UserCount: userCount, PermissionCodes: codes, Scopes: scopes,
	}
}

func menuToResponse(m *domain.Menu) MenuResponse {
	level := 1
	if m.ParentID != nil {
		level = 2
	}
	return MenuResponse{
		ID: m.ID, Title: m.Title, URL: m.URL, SortOrder: m.SortOrder,
		Icon: m.Icon, PermissionCode: string(m.PermissionCode),
		ParentID: m.ParentID, MenuType: m.MenuType, Level: level,
	}
}

func paginate[T any](data []T, total int64, page, pageSize int) *PaginatedResult[T] {
	pages := int(total) / pageSize
	if int(total)%pageSize > 0 {
		pages++
	}
	return &PaginatedResult[T]{Data: data, Total: total, Page: page, PageSize: pageSize, TotalPages: pages}
}

func filterMenuByPermission(menus []*domain.Menu, ps *permission.PermissionSet) []*domain.Menu {
	if ps == nil {
		return nil
	}
	var result []*domain.Menu
	for _, m := range menus {
		if m.PermissionCode == "" || ps.Has(m.PermissionCode) {
			result = append(result, m)
		}
	}
	return result
}

func validatePasswordPolicy(user *domain.User, password string) error {
	if len(password) < 8 {
		return errors.New("mật khẩu phải có ít nhất 8 ký tự")
	}

	var hasUpper, hasLower, hasDigit, hasSpecial bool
	for _, r := range password {
		switch {
		case unicode.IsUpper(r):
			hasUpper = true
		case unicode.IsLower(r):
			hasLower = true
		case unicode.IsDigit(r):
			hasDigit = true
		default:
			hasSpecial = true
		}
	}

	if !hasUpper || !hasLower || !hasDigit || !hasSpecial {
		return errors.New("mật khẩu phải gồm chữ hoa, chữ thường, số và ký tự đặc biệt")
	}

	if user.PasswordHash != "" && bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)) == nil {
		return errors.New("mật khẩu mới không được trùng với các mật khẩu đã dùng gần đây")
	}

	for _, oldHash := range user.PasswordHistory {
		if bcrypt.CompareHashAndPassword([]byte(oldHash), []byte(password)) == nil {
			return errors.New("mật khẩu mới không được trùng với các mật khẩu đã dùng gần đây")
		}
	}

	return nil
}

func appendPasswordHistory(history []string, hash string) []string {
	next := append(append([]string{}, history...), hash)
	if len(next) > passwordHistoryLimit {
		next = next[len(next)-passwordHistoryLimit:]
	}
	return next
}

// ─── Log Usecase ─────────────────────────────────────────────────────────────

type AuditLogResponse struct {
	ID         uint      `json:"id"`
	UserID     uint      `json:"user_id"`
	Username   string    `json:"username"`
	Action     string    `json:"action"`
	Resource   string    `json:"resource"`
	ResourceID string    `json:"resource_id"`
	IPAddress  string    `json:"ip_address"`
	UserAgent  string    `json:"user_agent"`
	Request    string    `json:"request"`
	Response   string    `json:"response"`
	Allowed    bool      `json:"allowed"`
	CreatedAt  time.Time `json:"created_at"`
}

type AuthHistoryResponse struct {
	ID        uint      `json:"id"`
	UserID    uint      `json:"user_id"`
	Username  string    `json:"username"`
	IPAddress string    `json:"ip_address"`
	UserAgent string    `json:"user_agent"`
	Status    string    `json:"status"`
	Note      string    `json:"note"`
	CreatedAt time.Time `json:"created_at"`
}

type LogUsecase struct {
	auditRepo domain.AuditLogRepository
	authRepo  domain.AuthHistoryRepository
}

func NewLogUsecase(auditRepo domain.AuditLogRepository, authRepo domain.AuthHistoryRepository) *LogUsecase {
	return &LogUsecase{auditRepo, authRepo}
}

func (uc *LogUsecase) ListAuditLogs(spec interface{}) (*PaginatedResult[AuditLogResponse], error) {
	logs, total, err := uc.auditRepo.List(spec)
	if err != nil {
		return nil, err
	}
	res := make([]AuditLogResponse, len(logs))
	for i, l := range logs {
		res[i] = AuditLogResponse{
			ID: l.ID, UserID: l.UserID, Username: l.Username, Action: l.Action,
			Resource: l.Resource, ResourceID: l.ResourceID, IPAddress: l.IPAddress,
			UserAgent: l.UserAgent, Request: l.Request, Response: l.Response,
			Allowed: l.Allowed, CreatedAt: l.CreatedAt,
		}
	}

	page, pageSize := 1, 10
	if s, ok := spec.(map[string]interface{}); ok {
		if v, exists := s["page"]; exists {
			page = v.(int)
		}
		if v, exists := s["page_size"]; exists {
			pageSize = v.(int)
		}
	}

	return paginate(res, total, page, pageSize), nil
}

func (uc *LogUsecase) ListAuthHistory(spec interface{}) (*PaginatedResult[AuthHistoryResponse], error) {
	histories, total, err := uc.authRepo.List(spec)
	if err != nil {
		return nil, err
	}
	res := make([]AuthHistoryResponse, len(histories))
	for i, h := range histories {
		res[i] = AuthHistoryResponse{
			ID: h.ID, UserID: h.UserID, Username: h.Username, IPAddress: h.IPAddress,
			UserAgent: h.UserAgent, Status: h.Status, Note: h.Note, CreatedAt: h.CreatedAt,
		}
	}

	page, pageSize := 1, 10
	if s, ok := spec.(map[string]interface{}); ok {
		if v, exists := s["page"]; exists {
			page = v.(int)
		}
		if v, exists := s["page_size"]; exists {
			pageSize = v.(int)
		}
	}

	return paginate(res, total, page, pageSize), nil
}

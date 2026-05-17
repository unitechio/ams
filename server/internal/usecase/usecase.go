package usecase

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/owner/auth-server/internal/authorization/permission"
	"github.com/owner/auth-server/internal/domain"
	jwtpkg "github.com/owner/auth-server/internal/jwt"
	passwordsvc "github.com/owner/auth-server/internal/security/password"
	"github.com/owner/auth-server/internal/security/ratelimit"
	"github.com/owner/auth-server/internal/security/sso"
	totpsvc "github.com/owner/auth-server/internal/security/totp"
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
	mockAuthCodes = struct {
		sync.RWMutex
		m map[string]authorizationCode
	}{m: make(map[string]authorizationCode)}
	loginIPLimiter       = ratelimit.New(20, 5*time.Minute, 15*time.Minute)
	loginIdentityLimiter = ratelimit.New(7, 10*time.Minute, 30*time.Minute)
)

const maxFailedLogins = 5
const passwordHistoryLimit = 5

var (
	ErrInvalidCredentials = errors.New("sai tên đăng nhập hoặc mật khẩu")
	ErrAccountLocked      = errors.New("tài khoản bị khóa tạm thời, vui lòng thử lại sau 30 phút")
	ErrAccountInactive    = errors.New("tài khoản không hoạt động")
	ErrTokenRevoked       = errors.New("phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại")
	ErrOTPRequired        = errors.New("cần xác thực OTP cho thiết bị hoặc phiên đăng nhập này")
)

// ─── DTOs (shared across usecases) ───────────────────────────────────────────

type LoginRequest struct {
	Username          string `json:"username" binding:"required,min=3"`
	Password          string `json:"password" binding:"required,min=6"`
	ClientID          string `json:"client_id"`
	ClientSecret      string `json:"client_secret"`
	GrantType         string `json:"grant_type"`
	Channel           string `json:"channel"`
	DeviceName        string `json:"device_name"`
	DeviceFingerprint string `json:"device_fingerprint"`
	OTPCode           string `json:"otp_code"`
	TrustDevice       bool   `json:"trust_device"`
	IPAddress         string `json:"-"`
	UserAgent         string `json:"-"`
}

type LoginResponse struct {
	AccessToken          string   `json:"access_token"`
	RefreshToken         string   `json:"refresh_token"`
	User                 UserInfo `json:"user"`
	MustChangePassword   bool     `json:"must_change_password"`
	PasswordExpired      bool     `json:"password_expired"`
	PasswordChangeReason string   `json:"password_change_reason,omitempty"`
}

type StepUpResponse struct {
	StepUpToken string    `json:"step_up_token"`
	ExpiresAt   time.Time `json:"expires_at"`
}

type ClientTokenResponse struct {
	AccessToken string    `json:"access_token"`
	TokenType   string    `json:"token_type"`
	ExpiresAt   time.Time `json:"expires_at"`
	ClientID    string    `json:"client_id"`
	Audiences   []string  `json:"audiences"`
}

type AuthorizeCodeRequest struct {
	Username            string `json:"username" binding:"required"`
	Password            string `json:"password" binding:"required"`
	ClientID            string `json:"client_id" binding:"required"`
	RedirectURI         string `json:"redirect_uri" binding:"required"`
	Scope               string `json:"scope"`
	State               string `json:"state"`
	CodeChallenge       string `json:"code_challenge"`
	CodeChallengeMethod string `json:"code_challenge_method"`
	Channel             string `json:"channel"`
	DeviceName          string `json:"device_name"`
	DeviceFingerprint   string `json:"device_fingerprint"`
	OTPCode             string `json:"otp_code"`
	TrustDevice         bool   `json:"trust_device"`
	IPAddress           string `json:"-"`
	UserAgent           string `json:"-"`
}

type AuthorizeCodeResponse struct {
	Code        string    `json:"code"`
	State       string    `json:"state"`
	RedirectURI string    `json:"redirect_uri"`
	ExpiresAt   time.Time `json:"expires_at"`
}

type CompleteSSORequest struct {
	ClientID          string `json:"client_id"`
	Channel           string `json:"channel"`
	DeviceName        string `json:"device_name"`
	DeviceFingerprint string `json:"device_fingerprint"`
	OTPCode           string `json:"otp_code"`
	TrustDevice       bool   `json:"trust_device"`
	IPAddress         string `json:"-"`
	UserAgent         string `json:"-"`
}

type DeviceListItem struct {
	ID         string `json:"id"`
	UserID     uint   `json:"user_id"`
	Username   string `json:"username"`
	Email      string `json:"email"`
	Device     string `json:"device"`
	IP         string `json:"ip"`
	ClientID   string `json:"client_id"`
	Trusted    bool   `json:"trusted"`
	LastActive string `json:"last_active"`
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
	AllowedClients    []string   `json:"allowed_clients"`
	AllowedChannels   []string   `json:"allowed_channels"`
	EmailVerified     bool       `json:"email_verified"`
	PasswordExpiresAt *time.Time `json:"password_expires_at,omitempty"`
	OneTimePassword   bool       `json:"one_time_password"`
	RequireOTP        bool       `json:"require_otp"`
	TwoFactorEnabled  bool       `json:"two_factor_enabled"`
}

// ─── Auth Usecase ─────────────────────────────────────────────────────────────

type AuthUsecase struct {
	userRepo   domain.UserRepository
	tokenRepo  domain.TokenRepository
	clientRepo domain.ClientRepository
	permRepo   domain.PermissionRepository
	authRepo   domain.AuthHistoryRepository
	jwt        *jwtpkg.Service
}

type sessionContext struct {
	SessionID         string
	TokenFamily       string
	ClientID          string
	Audiences         []string
	DeviceName        string
	DeviceFingerprint string
	IPAddress         string
	UserAgent         string
	Trusted           bool
	RotatedFrom       string
}

type authorizationCode struct {
	UserID              uint
	Username            string
	ClientID            string
	RedirectURI         string
	CodeChallenge       string
	CodeChallengeMethod string
	Audiences           []string
	ExpiresAt           time.Time
}

func NewAuthUsecase(
	userRepo domain.UserRepository,
	tokenRepo domain.TokenRepository,
	clientRepo domain.ClientRepository,
	permRepo domain.PermissionRepository,
	authRepo domain.AuthHistoryRepository,
	jwt *jwtpkg.Service,
) *AuthUsecase {
	return &AuthUsecase{userRepo, tokenRepo, clientRepo, permRepo, authRepo, jwt}
}

func (uc *AuthUsecase) Login(req *LoginRequest) (*LoginResponse, error) {
	now := time.Now()
	ipKey := ratelimit.Normalize("login_ip", req.IPAddress)
	identityKey := ratelimit.Normalize("login_identity", req.IPAddress, req.Username)
	if err := loginIPLimiter.Allow(ipKey, now); err != nil {
		uc.recordLoginHistory(0, req.Username, req.IPAddress, req.UserAgent, "blocked", "Rate limit theo IP")
		return nil, errors.New("quá nhiều lần đăng nhập từ IP này, vui lòng thử lại sau")
	}
	if err := loginIdentityLimiter.Allow(identityKey, now); err != nil {
		uc.recordLoginHistory(0, req.Username, req.IPAddress, req.UserAgent, "blocked", "Rate limit theo tài khoản/IP")
		return nil, errors.New("đăng nhập bị giới hạn tạm thời do quá nhiều lần thất bại")
	}
	user, err := uc.userRepo.FindByUsername(req.Username)
	if err != nil {
		loginIPLimiter.RegisterFailure(ipKey, now)
		loginIdentityLimiter.RegisterFailure(identityKey, now)
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
	client, channel, deviceName, deviceFingerprint, err := uc.validateClientAccess(user, req)
	if err != nil {
		uc.recordLoginHistory(user.ID, req.Username, req.IPAddress, req.UserAgent, "failed", err.Error())
		return nil, err
	}
	passwordOK, needsRehash, err := passwordsvc.Verify(user.PasswordHash, req.Password)
	if err != nil || !passwordOK {
		loginIPLimiter.RegisterFailure(ipKey, now)
		loginIdentityLimiter.RegisterFailure(identityKey, now)
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
	trustedDevice := false
	if deviceFingerprint != "" {
		if _, err := uc.tokenRepo.FindTrustedDevice(user.ID, client.ClientID, deviceFingerprint); err == nil {
			trustedDevice = true
		}
	}
	if user.TwoFactorEnabled {
		if strings.TrimSpace(req.OTPCode) == "" {
			uc.recordLoginHistory(user.ID, req.Username, req.IPAddress, req.UserAgent, "failed", "Thiếu mã TOTP")
			return nil, ErrOTPRequired
		}
		if !totpsvc.ValidateCode(user.TOTPSecret, strings.TrimSpace(req.OTPCode), time.Now()) {
			loginIPLimiter.RegisterFailure(ipKey, now)
			loginIdentityLimiter.RegisterFailure(identityKey, now)
			uc.recordLoginHistory(user.ID, req.Username, req.IPAddress, req.UserAgent, "failed", "Mã TOTP không hợp lệ")
			return nil, errors.New("mã OTP không hợp lệ")
		}
	} else if user.RequireOTP && !trustedDevice {
		if strings.TrimSpace(req.OTPCode) == "" {
			if err := uc.issueEmailOTP(user, "login"); err != nil {
				return nil, err
			}
			uc.recordLoginHistory(user.ID, req.Username, req.IPAddress, req.UserAgent, "failed", "Đã gửi email OTP cho thiết bị mới hoặc không tin cậy")
			return nil, ErrOTPRequired
		}
		if !verifyOneTimeCode(user.EmailOTPHash, user.EmailOTPExpiresAt, strings.TrimSpace(req.OTPCode)) {
			loginIPLimiter.RegisterFailure(ipKey, now)
			loginIdentityLimiter.RegisterFailure(identityKey, now)
			uc.recordLoginHistory(user.ID, req.Username, req.IPAddress, req.UserAgent, "failed", "Email OTP không hợp lệ")
			return nil, errors.New("mã OTP không hợp lệ")
		}
		user.EmailOTPHash = ""
		user.EmailOTPExpiresAt = nil
		_ = uc.userRepo.Save(user)
	}
	loginIPLimiter.Reset(ipKey)
	loginIdentityLimiter.Reset(identityKey)
	if needsRehash {
		if rehashed, hashErr := passwordsvc.Hash(req.Password); hashErr == nil {
			user.PasswordHash = rehashed
			user.PasswordHistory = appendPasswordHistory(user.PasswordHistory, rehashed)
			_ = uc.userRepo.Save(user)
		}
	}
	uc.userRepo.UpdateLastLogin(user.ID)
	uc.recordLoginHistory(user.ID, req.Username, req.IPAddress, req.UserAgent, "success", "")
	return uc.buildLoginResponse(user, sessionContext{
		SessionID:         generateOpaqueID(16),
		TokenFamily:       generateOpaqueID(16),
		ClientID:          client.ClientID,
		Audiences:         cloneStrings(client.Audiences),
		DeviceName:        fmt.Sprintf("%s [%s]", deviceName, channel),
		DeviceFingerprint: deviceFingerprint,
		IPAddress:         req.IPAddress,
		UserAgent:         req.UserAgent,
		Trusted:           trustedDevice || req.TrustDevice,
	})
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
	if stored.Revoked {
		if stored.TokenFamily != "" {
			_ = uc.tokenRepo.RevokeFamily(stored.TokenFamily, "refresh_token_reuse_detected")
		}
		return nil, ErrTokenRevoked
	}
	_ = uc.tokenRepo.RevokeToken(refreshTokenStr)

	user, err := uc.userRepo.FindByID(claims.UserID)
	if err != nil {
		return nil, ErrTokenRevoked
	}
	audiences := []string{}
	if uc.clientRepo != nil && stored.ClientID != "" {
		if client, clientErr := uc.clientRepo.FindByClientID(stored.ClientID); clientErr == nil {
			audiences = cloneStrings(client.Audiences)
		}
	}
	return uc.buildLoginResponse(user, sessionContext{
		SessionID:         stored.SessionID,
		TokenFamily:       stored.TokenFamily,
		ClientID:          stored.ClientID,
		Audiences:         audiences,
		DeviceName:        stored.DeviceName,
		DeviceFingerprint: stored.DeviceFingerprint,
		IPAddress:         stored.IPAddress,
		UserAgent:         stored.UserAgent,
		Trusted:           stored.Trusted,
		RotatedFrom:       stored.Token,
	})
}

func (uc *AuthUsecase) IssueClientToken(clientID, clientSecret, grantType string) (*ClientTokenResponse, error) {
	if uc.clientRepo == nil {
		return nil, errors.New("client registry chưa sẵn sàng")
	}
	client, err := uc.clientRepo.FindByClientID(strings.TrimSpace(clientID))
	if err != nil || !client.Active {
		return nil, errors.New("client không tồn tại hoặc đã bị vô hiệu")
	}
	if strings.TrimSpace(grantType) != "client_credentials" {
		return nil, errors.New("grant_type này chưa được hỗ trợ cho token machine-to-machine")
	}
	if !containsOrEmpty(client.GrantTypes, "client_credentials") {
		return nil, errors.New("client không được phép dùng client_credentials")
	}
	if client.Public || strings.TrimSpace(clientSecret) != client.ClientSecret {
		return nil, errors.New("client_secret không hợp lệ")
	}
	token, err := uc.jwt.GenerateAccessToken(0, client.ClientID, []string{"service"}, generateOpaqueID(12), client.ClientID, cloneStrings(client.Audiences))
	if err != nil {
		return nil, err
	}
	return &ClientTokenResponse{
		AccessToken: token,
		TokenType:   "Bearer",
		ExpiresAt:   time.Now().Add(15 * time.Minute),
		ClientID:    client.ClientID,
		Audiences:   cloneStrings(client.Audiences),
	}, nil
}

func (uc *AuthUsecase) ExchangeAuthorizationCode(clientID, clientSecret, code, redirectURI, codeVerifier string) (*ClientTokenResponse, error) {
	if uc.clientRepo == nil {
		return nil, errors.New("client registry chưa sẵn sàng")
	}
	client, err := uc.clientRepo.FindByClientID(strings.TrimSpace(clientID))
	if err != nil || !client.Active {
		return nil, errors.New("client không tồn tại hoặc đã bị vô hiệu")
	}
	if !client.Public && strings.TrimSpace(clientSecret) != client.ClientSecret {
		return nil, errors.New("client_secret không hợp lệ")
	}
	mockAuthCodes.Lock()
	authCode, ok := mockAuthCodes.m[strings.TrimSpace(code)]
	if ok {
		delete(mockAuthCodes.m, strings.TrimSpace(code))
	}
	mockAuthCodes.Unlock()
	if !ok || authCode.ExpiresAt.Before(time.Now()) {
		return nil, errors.New("authorization code không hợp lệ hoặc đã hết hạn")
	}
	if authCode.ClientID != client.ClientID {
		return nil, errors.New("authorization code không thuộc về client này")
	}
	if authCode.RedirectURI != strings.TrimSpace(redirectURI) {
		return nil, errors.New("redirect_uri không khớp")
	}
	if client.PKCERequired || authCode.CodeChallenge != "" {
		if strings.TrimSpace(codeVerifier) == "" {
			return nil, errors.New("code_verifier là bắt buộc cho PKCE")
		}
		if !verifyPKCE(authCode.CodeChallenge, authCode.CodeChallengeMethod, codeVerifier) {
			return nil, errors.New("code_verifier không hợp lệ")
		}
	}
	token, err := uc.jwt.GenerateAccessToken(authCode.UserID, authCode.Username, []string{"user"}, generateOpaqueID(12), client.ClientID, cloneStrings(authCode.Audiences))
	if err != nil {
		return nil, err
	}
	return &ClientTokenResponse{
		AccessToken: token,
		TokenType:   "Bearer",
		ExpiresAt:   time.Now().Add(15 * time.Minute),
		ClientID:    client.ClientID,
		Audiences:   cloneStrings(authCode.Audiences),
	}, nil
}

func (uc *AuthUsecase) AuthorizeCode(req *AuthorizeCodeRequest) (*AuthorizeCodeResponse, error) {
	loginResp, err := uc.Login(&LoginRequest{
		Username:          req.Username,
		Password:          req.Password,
		ClientID:          req.ClientID,
		GrantType:         "authorization_code",
		Channel:           req.Channel,
		DeviceName:        req.DeviceName,
		DeviceFingerprint: req.DeviceFingerprint,
		OTPCode:           req.OTPCode,
		TrustDevice:       req.TrustDevice,
		IPAddress:         req.IPAddress,
		UserAgent:         req.UserAgent,
	})
	if err != nil {
		return nil, err
	}
	if uc.clientRepo == nil {
		return nil, errors.New("client registry chưa sẵn sàng")
	}
	client, err := uc.clientRepo.FindByClientID(strings.TrimSpace(req.ClientID))
	if err != nil || !client.Active {
		return nil, errors.New("client không tồn tại hoặc đã bị vô hiệu")
	}
	redirectURI := strings.TrimSpace(req.RedirectURI)
	if !containsOrEmpty(client.RedirectURIs, redirectURI) {
		return nil, errors.New("redirect_uri không nằm trong whitelist của client")
	}
	if client.PKCERequired && strings.TrimSpace(req.CodeChallenge) == "" {
		return nil, errors.New("code_challenge là bắt buộc cho client này")
	}
	code := generateOpaqueID(24)
	userInfo := loginResp.User
	entry := authorizationCode{
		UserID:              userInfo.ID,
		Username:            userInfo.Username,
		ClientID:            client.ClientID,
		RedirectURI:         redirectURI,
		CodeChallenge:       strings.TrimSpace(req.CodeChallenge),
		CodeChallengeMethod: strings.TrimSpace(req.CodeChallengeMethod),
		Audiences:           cloneStrings(client.Audiences),
		ExpiresAt:           time.Now().Add(5 * time.Minute),
	}
	mockAuthCodes.Lock()
	mockAuthCodes.m[code] = entry
	mockAuthCodes.Unlock()
	return &AuthorizeCodeResponse{
		Code:        code,
		State:       req.State,
		RedirectURI: redirectURI,
		ExpiresAt:   entry.ExpiresAt,
	}, nil
}

func (uc *AuthUsecase) CompleteSSO(providerID, code, state string, req *CompleteSSORequest) (*LoginResponse, error) {
	identity, err := sso.Complete(providerID, state, code)
	if err != nil {
		return nil, err
	}
	user, err := uc.findOrProvisionSSOUser(identity)
	if err != nil {
		return nil, err
	}
	if user.Status == "inactive" {
		uc.recordLoginHistory(user.ID, user.Username, req.IPAddress, req.UserAgent, "failed", "Tài khoản SSO bị vô hiệu hóa")
		return nil, ErrAccountInactive
	}
	if user.Status == "locked" && user.LockedUntil != nil && user.LockedUntil.Before(time.Now()) {
		user.Status = "active"
		user.LockedUntil = nil
		user.FailedLogins = 0
		_ = uc.userRepo.Save(user)
	}
	if user.IsLocked() {
		uc.recordLoginHistory(user.ID, user.Username, req.IPAddress, req.UserAgent, "locked", "Tài khoản SSO đang bị khóa")
		return nil, ErrAccountLocked
	}
	loginReq := &LoginRequest{
		ClientID:          req.ClientID,
		GrantType:         "authorization_code",
		Channel:           req.Channel,
		DeviceName:        req.DeviceName,
		DeviceFingerprint: req.DeviceFingerprint,
		OTPCode:           req.OTPCode,
		TrustDevice:       req.TrustDevice,
		IPAddress:         req.IPAddress,
		UserAgent:         req.UserAgent,
	}
	client, channel, deviceName, deviceFingerprint, err := uc.validateClientAccess(user, loginReq)
	if err != nil {
		uc.recordLoginHistory(user.ID, user.Username, req.IPAddress, req.UserAgent, "failed", err.Error())
		return nil, err
	}
	trustedDevice := false
	if deviceFingerprint != "" {
		if _, err := uc.tokenRepo.FindTrustedDevice(user.ID, client.ClientID, deviceFingerprint); err == nil {
			trustedDevice = true
		}
	}
	if user.TwoFactorEnabled {
		if strings.TrimSpace(req.OTPCode) == "" {
			uc.recordLoginHistory(user.ID, user.Username, req.IPAddress, req.UserAgent, "failed", "Thiếu mã TOTP cho SSO")
			return nil, ErrOTPRequired
		}
		if !totpsvc.ValidateCode(user.TOTPSecret, strings.TrimSpace(req.OTPCode), time.Now()) {
			uc.recordLoginHistory(user.ID, user.Username, req.IPAddress, req.UserAgent, "failed", "Mã TOTP SSO không hợp lệ")
			return nil, errors.New("mã OTP không hợp lệ")
		}
	} else if user.RequireOTP && !trustedDevice {
		if strings.TrimSpace(req.OTPCode) == "" {
			if err := uc.issueEmailOTP(user, "sso_login"); err != nil {
				return nil, err
			}
			uc.recordLoginHistory(user.ID, user.Username, req.IPAddress, req.UserAgent, "failed", "Đã gửi email OTP cho phiên SSO")
			return nil, ErrOTPRequired
		}
		if !verifyOneTimeCode(user.EmailOTPHash, user.EmailOTPExpiresAt, strings.TrimSpace(req.OTPCode)) {
			uc.recordLoginHistory(user.ID, user.Username, req.IPAddress, req.UserAgent, "failed", "Email OTP SSO không hợp lệ")
			return nil, errors.New("mã OTP không hợp lệ")
		}
		user.EmailOTPHash = ""
		user.EmailOTPExpiresAt = nil
		_ = uc.userRepo.Save(user)
	}
	_ = uc.userRepo.UpdateLastLogin(user.ID)
	uc.recordLoginHistory(user.ID, user.Username, req.IPAddress, req.UserAgent, "success", "sso:"+providerID)
	return uc.buildLoginResponse(user, sessionContext{
		SessionID:         generateOpaqueID(16),
		TokenFamily:       generateOpaqueID(16),
		ClientID:          client.ClientID,
		Audiences:         cloneStrings(client.Audiences),
		DeviceName:        fmt.Sprintf("%s [%s]", deviceName, channel),
		DeviceFingerprint: deviceFingerprint,
		IPAddress:         req.IPAddress,
		UserAgent:         req.UserAgent,
		Trusted:           trustedDevice || req.TrustDevice,
	})
}

func (uc *AuthUsecase) Logout(userID uint, sessionID string) error {
	if sessionID != "" {
		return uc.tokenRepo.RevokeSession(userID, sessionID)
	}
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
		AllowedClients:    user.AllowedClients,
		AllowedChannels:   user.AllowedChannels,
		EmailVerified:     user.EmailVerified,
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
	passwordOK, _, verifyErr := passwordsvc.Verify(user.PasswordHash, oldPw)
	if verifyErr != nil || !passwordOK {
		return errors.New("mật khẩu cũ không đúng")
	}
	if err := validatePasswordPolicy(user, newPw); err != nil {
		return err
	}
	hash, _ := passwordsvc.Hash(newPw)
	user.PasswordHash = string(hash)
	user.PasswordHistory = appendPasswordHistory(user.PasswordHistory, user.PasswordHash)
	user.OneTimePassword = false
	if user.PasswordExpiresAt != nil && !user.PasswordExpiresAt.After(time.Now()) {
		user.PasswordExpiresAt = nil
	}
	uc.tokenRepo.RevokeByUserID(userID)
	return uc.userRepo.Save(user)
}

func (uc *AuthUsecase) buildLoginResponse(user *domain.User, session sessionContext) (*LoginResponse, error) {
	ps := user.EffectivePermissions()
	roles := roleNames(user)
	if session.SessionID == "" {
		session.SessionID = generateOpaqueID(16)
	}
	if session.TokenFamily == "" {
		session.TokenFamily = generateOpaqueID(16)
	}
	if session.ClientID == "" {
		session.ClientID = "web_portal"
	}
	passwordExpired := user.PasswordExpiresAt != nil && !user.PasswordExpiresAt.After(time.Now())
	mustChangePassword := user.OneTimePassword || passwordExpired
	passwordChangeReason := ""
	if user.OneTimePassword {
		passwordChangeReason = "one_time_password"
	} else if passwordExpired {
		passwordChangeReason = "password_expired"
	}

	accessToken, err := uc.jwt.GenerateAccessToken(user.ID, user.Username, roles, session.SessionID, session.ClientID, session.Audiences)
	if err != nil {
		return nil, err
	}
	refreshStr, expiry, err := uc.jwt.GenerateRefreshToken(user.ID, user.Username, session.SessionID, session.ClientID)
	if err != nil {
		return nil, err
	}
	uc.tokenRepo.Save(&domain.RefreshToken{
		UserID:            user.ID,
		Token:             refreshStr,
		SessionID:         session.SessionID,
		TokenFamily:       session.TokenFamily,
		ClientID:          session.ClientID,
		DeviceName:        session.DeviceName,
		DeviceFingerprint: session.DeviceFingerprint,
		IPAddress:         session.IPAddress,
		UserAgent:         session.UserAgent,
		Trusted:           session.Trusted,
		RotatedFrom:       session.RotatedFrom,
		ExpiresAt:         expiry,
		LastUsedAt:        time.Now(),
	})

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
			AllowedClients:    user.AllowedClients,
			AllowedChannels:   user.AllowedChannels,
			EmailVerified:     user.EmailVerified,
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
	ClientID   string `json:"client_id"`
	Trusted    bool   `json:"trusted"`
	LastActive string `json:"last_active"`
	IsCurrent  bool   `json:"is_current"`
}

type DeviceListResponse = PaginatedResult[DeviceListItem]

type Setup2FAResponse struct {
	Secret    string `json:"secret"`
	QRCodeURL string `json:"qr_code_url"`
}

func (uc *AuthUsecase) ListSessions(userID uint, currentSessionID string) ([]SessionResponse, error) {
	sessions, err := uc.tokenRepo.ListActiveSessions(userID)
	if err != nil {
		return nil, err
	}
	result := make([]SessionResponse, 0, len(sessions))
	for _, session := range sessions {
		result = append(result, SessionResponse{
			ID:         session.SessionID,
			Device:     session.DeviceName,
			IP:         session.IPAddress,
			Location:   "N/A",
			ClientID:   session.ClientID,
			Trusted:    session.Trusted,
			LastActive: session.LastUsedAt.Format(time.RFC3339),
			IsCurrent:  session.SessionID == currentSessionID,
		})
	}
	return result, nil
}

func (uc *AuthUsecase) RevokeSession(userID uint, sessionID string) error {
	return uc.tokenRepo.RevokeSession(userID, sessionID)
}

func (uc *AuthUsecase) RevokeAllSessions(userID uint) error {
	return uc.tokenRepo.RevokeByUserID(userID)
}

func (uc *AuthUsecase) ListDevices(filters map[string]interface{}) (*DeviceListResponse, error) {
	sessions, total, err := uc.tokenRepo.ListSessions(filters)
	if err != nil {
		return nil, err
	}
	items := make([]DeviceListItem, 0, len(sessions))
	for _, session := range sessions {
		items = append(items, DeviceListItem{
			ID:         session.SessionID,
			UserID:     session.UserID,
			Username:   session.Username,
			Email:      session.UserEmail,
			Device:     session.DeviceName,
			IP:         session.IPAddress,
			ClientID:   session.ClientID,
			Trusted:    session.Trusted,
			LastActive: session.LastUsedAt.Format(time.RFC3339),
		})
	}
	page, _ := filters["page"].(int)
	pageSize, _ := filters["page_size"].(int)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	return paginate(items, total, page, pageSize), nil
}

func (uc *AuthUsecase) AdminRevokeDevice(sessionID string) error {
	return uc.tokenRepo.RevokeSessionByID(sessionID)
}

func (uc *AuthUsecase) Setup2FA(userID uint) (*Setup2FAResponse, error) {
	user, err := uc.userRepo.FindByID(userID)
	if err != nil {
		return nil, errors.New("người dùng không tồn tại")
	}
	secret, err := totpsvc.GenerateSecret()
	if err != nil {
		return nil, err
	}
	user.PendingTOTPSecret = secret
	if err := uc.userRepo.Save(user); err != nil {
		return nil, err
	}
	otpAuth := totpsvc.BuildOTPAuthURL("AMS", user.Email, secret)
	return &Setup2FAResponse{
		Secret:    secret,
		QRCodeURL: "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=" + url.QueryEscape(otpAuth),
	}, nil
}

func (uc *AuthUsecase) Verify2FA(userID uint, code string) error {
	user, err := uc.userRepo.FindByID(userID)
	if err != nil {
		return errors.New("người dùng không tồn tại")
	}
	secret := user.PendingTOTPSecret
	if secret == "" {
		secret = user.TOTPSecret
	}
	if !totpsvc.ValidateCode(secret, strings.TrimSpace(code), time.Now()) {
		return errors.New("mã OTP không hợp lệ")
	}
	user.TOTPSecret = secret
	user.PendingTOTPSecret = ""
	user.TwoFactorEnabled = true
	return uc.userRepo.Save(user)
}

func (uc *AuthUsecase) Disable2FA(userID uint) error {
	user, err := uc.userRepo.FindByID(userID)
	if err != nil {
		return errors.New("người dùng không tồn tại")
	}
	user.TwoFactorEnabled = false
	user.TOTPSecret = ""
	user.PendingTOTPSecret = ""
	return uc.userRepo.Save(user)
}

func (uc *AuthUsecase) StepUp(userID uint, sessionID, clientID, password, otpCode string) (*StepUpResponse, error) {
	user, err := uc.userRepo.FindByID(userID)
	if err != nil {
		return nil, errors.New("người dùng không tồn tại")
	}
	ok, _, err := passwordsvc.Verify(user.PasswordHash, password)
	if err != nil || !ok {
		return nil, ErrInvalidCredentials
	}
	if user.TwoFactorEnabled {
		if strings.TrimSpace(otpCode) == "" {
			return nil, ErrOTPRequired
		}
		if !totpsvc.ValidateCode(user.TOTPSecret, strings.TrimSpace(otpCode), time.Now()) {
			return nil, errors.New("mã OTP không hợp lệ")
		}
	} else if user.RequireOTP {
		if strings.TrimSpace(otpCode) == "" {
			if err := uc.issueEmailOTP(user, "step_up"); err != nil {
				return nil, err
			}
			return nil, ErrOTPRequired
		}
		if !verifyOneTimeCode(user.EmailOTPHash, user.EmailOTPExpiresAt, strings.TrimSpace(otpCode)) {
			return nil, errors.New("mã OTP không hợp lệ")
		}
		user.EmailOTPHash = ""
		user.EmailOTPExpiresAt = nil
		if err := uc.userRepo.Save(user); err != nil {
			return nil, err
		}
	}
	token, expiresAt, err := uc.jwt.GenerateStepUpToken(user.ID, user.Username, sessionID, clientID, 10*time.Minute)
	if err != nil {
		return nil, err
	}
	return &StepUpResponse{StepUpToken: token, ExpiresAt: expiresAt}, nil
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
	if err := validatePasswordPolicy(user, newPassword); err != nil {
		return err
	}
	hash, _ := passwordsvc.Hash(newPassword)
	user.PasswordHash = string(hash)
	user.PasswordHistory = appendPasswordHistory(user.PasswordHistory, user.PasswordHash)
	user.OneTimePassword = false

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
	otp := generateNumericCode()
	expiry := time.Now().Add(15 * time.Minute)
	user.EmailVerifyHash = hashOneTimeCode(otp)
	user.EmailVerifyExpiry = &expiry
	if err := uc.userRepo.Save(user); err != nil {
		return err
	}
	token := fmt.Sprintf("%d:%s", user.ID, otp)

	fmt.Printf("\n=======================================================\n")
	fmt.Printf("📧 [MOCK EMAIL] XÁC MINH TÀI KHOẢN EMAIL\n")
	fmt.Printf("   Gửi tới: %s\n", user.Email)
	fmt.Printf("   Mã xác minh của bạn là: %s\n", token)
	fmt.Printf("   (Nhập mã OTP này trên giao diện web để kích hoạt)\n")
	fmt.Printf("=======================================================\n\n")

	return nil
}

func (uc *AuthUsecase) VerifyEmail(token string) error {
	parts := strings.SplitN(strings.TrimSpace(token), ":", 2)
	if len(parts) != 2 {
		return errors.New("mã OTP không hợp lệ hoặc đã hết hạn")
	}
	userID64, err := strconv.ParseUint(parts[0], 10, 64)
	if err != nil {
		return errors.New("mã OTP không hợp lệ hoặc đã hết hạn")
	}
	user, err := uc.userRepo.FindByID(uint(userID64))
	if err != nil {
		return errors.New("người dùng không tồn tại")
	}
	if !verifyOneTimeCode(user.EmailVerifyHash, user.EmailVerifyExpiry, parts[1]) {
		return errors.New("mã OTP không hợp lệ hoặc đã hết hạn")
	}
	user.EmailVerified = true
	user.EmailVerifyHash = ""
	user.EmailVerifyExpiry = nil
	user.Status = "active"
	if err := uc.userRepo.Save(user); err != nil {
		return err
	}
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
		AllowedClients:    req.AllowedClients,
		AllowedChannels:   req.AllowedChannels,
	}
	if err := validatePasswordPolicy(u, req.Password); err != nil {
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
	hash, _ := passwordsvc.Hash(newPassword)
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

type CreateClientReq struct {
	ClientID     string   `json:"client_id" binding:"required"`
	ClientSecret string   `json:"client_secret"`
	Name         string   `json:"name" binding:"required"`
	Description  string   `json:"description"`
	AppType      string   `json:"app_type"`
	Public       bool     `json:"public"`
	PKCERequired bool     `json:"pkce_required"`
	Active       bool     `json:"active"`
	GrantTypes   []string `json:"grant_types"`
	RedirectURIs []string `json:"redirect_uris"`
	Audiences    []string `json:"audiences"`
	Channels     []string `json:"channels"`
	TrustedTypes []string `json:"trusted_types"`
}

type UpdateClientReq = CreateClientReq

type ClientResponse struct {
	ID           uint      `json:"id"`
	ClientID     string    `json:"client_id"`
	ClientSecret string    `json:"client_secret"`
	Name         string    `json:"name"`
	Description  string    `json:"description"`
	AppType      string    `json:"app_type"`
	Public       bool      `json:"public"`
	PKCERequired bool      `json:"pkce_required"`
	Active       bool      `json:"active"`
	GrantTypes   []string  `json:"grant_types"`
	RedirectURIs []string  `json:"redirect_uris"`
	Audiences    []string  `json:"audiences"`
	Channels     []string  `json:"channels"`
	TrustedTypes []string  `json:"trusted_types"`
	CreatedAt    time.Time `json:"created_at"`
}

type ClientUsecase struct {
	repo domain.ClientRepository
}

func NewClientUsecase(repo domain.ClientRepository) *ClientUsecase {
	return &ClientUsecase{repo: repo}
}

func (uc *ClientUsecase) List(filters map[string]interface{}, page, pageSize int) (*PaginatedResult[ClientResponse], error) {
	filters["page"] = page
	filters["page_size"] = pageSize
	clients, total, err := uc.repo.List(filters)
	if err != nil {
		return nil, err
	}
	data := make([]ClientResponse, len(clients))
	for i, client := range clients {
		data[i] = clientToResponse(client)
	}
	return paginate(data, total, page, pageSize), nil
}

func (uc *ClientUsecase) Create(req *CreateClientReq) (*ClientResponse, error) {
	client := &domain.AuthClient{
		ClientID:     strings.TrimSpace(req.ClientID),
		ClientSecret: strings.TrimSpace(req.ClientSecret),
		Name:         strings.TrimSpace(req.Name),
		Description:  strings.TrimSpace(req.Description),
		AppType:      strings.TrimSpace(req.AppType),
		Public:       req.Public,
		PKCERequired: req.PKCERequired,
		Active:       req.Active,
		GrantTypes:   cleanStringList(req.GrantTypes),
		RedirectURIs: cleanStringList(req.RedirectURIs),
		Audiences:    cleanStringList(req.Audiences),
		Channels:     cleanStringList(req.Channels),
		TrustedTypes: cleanStringList(req.TrustedTypes),
	}
	normalizeClient(client)
	if err := uc.repo.Save(client); err != nil {
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
	client.Public = req.Public
	client.PKCERequired = req.PKCERequired
	client.Active = req.Active
	client.GrantTypes = cleanStringList(req.GrantTypes)
	client.RedirectURIs = cleanStringList(req.RedirectURIs)
	client.Audiences = cleanStringList(req.Audiences)
	client.Channels = cleanStringList(req.Channels)
	client.TrustedTypes = cleanStringList(req.TrustedTypes)
	normalizeClient(client)
	if err := uc.repo.Save(client); err != nil {
		return nil, err
	}
	resp := clientToResponse(client)
	return &resp, nil
}

func (uc *ClientUsecase) Delete(id uint) error {
	return uc.repo.Delete(id)
}

func (uc *ClientUsecase) findByID(id uint) (*domain.AuthClient, error) {
	clients, _, err := uc.repo.List(map[string]interface{}{"page": 1, "page_size": 500})
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

	if user.PasswordHash != "" {
		if ok, _, err := passwordsvc.Verify(user.PasswordHash, password); err == nil && ok {
			return errors.New("mật khẩu mới không được trùng với các mật khẩu đã dùng gần đây")
		}
	}

	for _, oldHash := range user.PasswordHistory {
		if ok, _, err := passwordsvc.Verify(oldHash, password); err == nil && ok {
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

func generateOpaqueID(size int) string {
	buffer := make([]byte, size)
	_, _ = rand.Read(buffer)
	return hex.EncodeToString(buffer)
}

func cloneStrings(values []string) []string {
	if len(values) == 0 {
		return []string{}
	}
	return append([]string{}, values...)
}

func cleanStringList(values []string) []string {
	result := make([]string, 0, len(values))
	seen := map[string]bool{}
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" || seen[strings.ToLower(trimmed)] {
			continue
		}
		seen[strings.ToLower(trimmed)] = true
		result = append(result, trimmed)
	}
	return result
}

func normalizeClient(client *domain.AuthClient) {
	if client.AppType == "" {
		client.AppType = "web_app"
	}
	if len(client.GrantTypes) == 0 {
		client.GrantTypes = []string{"password", "refresh_token"}
	}
	if len(client.Channels) == 0 {
		client.Channels = []string{"web"}
	}
	if len(client.Audiences) == 0 {
		client.Audiences = []string{"default-api"}
	}
	if !client.Public && client.ClientSecret == "" {
		client.ClientSecret = generateOpaqueID(16)
	}
}

func clientToResponse(client *domain.AuthClient) ClientResponse {
	return ClientResponse{
		ID:           client.ID,
		ClientID:     client.ClientID,
		ClientSecret: client.ClientSecret,
		Name:         client.Name,
		Description:  client.Description,
		AppType:      client.AppType,
		Public:       client.Public,
		PKCERequired: client.PKCERequired,
		Active:       client.Active,
		GrantTypes:   cloneStrings(client.GrantTypes),
		RedirectURIs: cloneStrings(client.RedirectURIs),
		Audiences:    cloneStrings(client.Audiences),
		Channels:     cloneStrings(client.Channels),
		TrustedTypes: cloneStrings(client.TrustedTypes),
		CreatedAt:    client.CreatedAt,
	}
}

func generateNumericCode() string {
	return fmt.Sprintf("%06d", time.Now().UnixNano()%1000000)
}

func hashOneTimeCode(code string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(code)))
	return hex.EncodeToString(sum[:])
}

func verifyPKCE(challenge, method, verifier string) bool {
	if strings.TrimSpace(challenge) == "" {
		return false
	}
	switch strings.ToUpper(strings.TrimSpace(method)) {
	case "", "PLAIN":
		return challenge == verifier
	case "S256":
		sum := sha256.Sum256([]byte(verifier))
		encoded := base64.RawURLEncoding.EncodeToString(sum[:])
		return encoded == challenge
	default:
		return false
	}
}

func verifyOneTimeCode(storedHash string, expiresAt *time.Time, code string) bool {
	if strings.TrimSpace(storedHash) == "" || expiresAt == nil || expiresAt.Before(time.Now()) {
		return false
	}
	return storedHash == hashOneTimeCode(code)
}

func (uc *AuthUsecase) issueEmailOTP(user *domain.User, reason string) error {
	otp := generateNumericCode()
	expiry := time.Now().Add(10 * time.Minute)
	user.EmailOTPHash = hashOneTimeCode(otp)
	user.EmailOTPExpiresAt = &expiry
	if err := uc.userRepo.Save(user); err != nil {
		return err
	}
	fmt.Printf("\n=======================================================\n")
	fmt.Printf("📧 [MOCK EMAIL OTP] XÁC THỰC %s\n", strings.ToUpper(reason))
	fmt.Printf("   Gửi tới: %s\n", user.Email)
	fmt.Printf("   Mã OTP của bạn là: %s\n", otp)
	fmt.Printf("   Hiệu lực đến: %s\n", expiry.Format(time.RFC3339))
	fmt.Printf("=======================================================\n\n")
	return nil
}

func containsOrEmpty(haystack []string, needle string) bool {
	if len(haystack) == 0 || needle == "" {
		return true
	}
	for _, item := range haystack {
		if strings.EqualFold(item, needle) {
			return true
		}
	}
	return false
}

func (uc *AuthUsecase) findOrProvisionSSOUser(identity *sso.Identity) (*domain.User, error) {
	user, err := uc.userRepo.FindByEmail(identity.Email)
	if err == nil {
		changed := false
		if identity.EmailVerified && !user.EmailVerified {
			user.EmailVerified = true
			changed = true
		}
		if strings.TrimSpace(user.FullName) == "" && strings.TrimSpace(identity.Name) != "" {
			user.FullName = strings.TrimSpace(identity.Name)
			changed = true
		}
		if changed {
			if saveErr := uc.userRepo.Save(user); saveErr != nil {
				return nil, saveErr
			}
		}
		return user, nil
	}
	passwordHash, hashErr := passwordsvc.Hash(generateOpaqueID(24) + "Aa1!")
	if hashErr != nil {
		return nil, hashErr
	}
	user = &domain.User{
		Username:        uc.generateUniqueUsername(identity),
		PasswordHash:    passwordHash,
		PasswordHistory: []string{passwordHash},
		AllowedClients:  []string{},
		AllowedChannels: []string{},
		EmailVerified:   true,
		Email:           strings.TrimSpace(identity.Email),
		FullName:        strings.TrimSpace(identity.Name),
		Status:          "active",
	}
	if user.FullName == "" {
		user.FullName = strings.TrimSpace(identity.Username)
	}
	if user.FullName == "" {
		user.FullName = user.Email
	}
	if err := uc.userRepo.Save(user); err != nil {
		return nil, err
	}
	return user, nil
}

func (uc *AuthUsecase) generateUniqueUsername(identity *sso.Identity) string {
	base := sanitizeUsername(identity.Username)
	if base == "" {
		localPart := identity.Email
		if idx := strings.Index(localPart, "@"); idx > 0 {
			localPart = localPart[:idx]
		}
		base = sanitizeUsername(localPart)
	}
	if base == "" {
		base = "sso-user"
	}
	users, _, err := uc.userRepo.List(nil)
	if err != nil {
		return base + "-" + strings.ToLower(generateOpaqueID(4))
	}
	taken := map[string]struct{}{}
	for _, item := range users {
		taken[strings.ToLower(item.Username)] = struct{}{}
	}
	candidate := base
	for i := 1; ; i++ {
		if _, exists := taken[strings.ToLower(candidate)]; !exists {
			return candidate
		}
		candidate = fmt.Sprintf("%s-%d", base, i+1)
	}
}

func sanitizeUsername(raw string) string {
	raw = strings.TrimSpace(strings.ToLower(raw))
	if raw == "" {
		return ""
	}
	var b strings.Builder
	for _, ch := range raw {
		if unicode.IsLetter(ch) || unicode.IsDigit(ch) || ch == '.' || ch == '-' || ch == '_' {
			b.WriteRune(ch)
		}
	}
	return strings.Trim(b.String(), "-._")
}

func (uc *AuthUsecase) validateClientAccess(user *domain.User, req *LoginRequest) (*domain.AuthClient, string, string, string, error) {
	clientID := strings.TrimSpace(req.ClientID)
	if clientID == "" {
		clientID = "web_portal"
	}
	if uc.clientRepo == nil {
		return nil, "", "", "", errors.New("client registry chưa sẵn sàng")
	}
	client, err := uc.clientRepo.FindByClientID(clientID)
	if err != nil || !client.Active {
		return nil, "", "", "", errors.New("client_id không hợp lệ hoặc chưa được đăng ký")
	}
	grantType := strings.TrimSpace(req.GrantType)
	if grantType == "" {
		grantType = "password"
	}
	if !containsOrEmpty(client.GrantTypes, grantType) {
		return nil, "", "", "", errors.New("grant_type không được hỗ trợ cho client này")
	}
	if !client.Public && strings.TrimSpace(req.ClientSecret) != client.ClientSecret {
		return nil, "", "", "", errors.New("client_secret không hợp lệ")
	}
	channel := strings.TrimSpace(req.Channel)
	if channel == "" && len(client.Channels) > 0 {
		channel = client.Channels[0]
	}
	if !containsOrEmpty(client.Channels, channel) {
		return nil, "", "", "", errors.New("channel không hợp lệ cho client này")
	}
	if !containsOrEmpty(user.AllowedClients, clientID) {
		return nil, "", "", "", errors.New("tài khoản này không được phép đăng nhập vào client hiện tại")
	}
	if !containsOrEmpty(user.AllowedChannels, channel) {
		return nil, "", "", "", errors.New("tài khoản này không được phép đăng nhập qua kênh hiện tại")
	}
	deviceName := strings.TrimSpace(req.DeviceName)
	if deviceName == "" {
		deviceName = "Unknown device"
	}
	deviceFingerprint := strings.TrimSpace(req.DeviceFingerprint)
	if deviceFingerprint == "" {
		deviceFingerprint = fmt.Sprintf("%s|%s|%s", clientID, req.IPAddress, req.UserAgent)
	}
	return client, channel, deviceName, deviceFingerprint, nil
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

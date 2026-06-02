package usecase

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/owner/auth-server/internal/domain"
	jwtpkg "github.com/owner/auth-server/internal/jwt"
	passwordsvc "github.com/owner/auth-server/internal/security/password"
	"github.com/owner/auth-server/internal/security/ratelimit"
	"github.com/owner/auth-server/internal/security/sso"
	totpsvc "github.com/owner/auth-server/internal/security/totp"
)

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

type AuthUsecase struct {
	userRepo        domain.UserRepository
	tokenRepo       domain.TokenRepository
	clientRepo      domain.ClientRepository
	channelRepo     domain.LoginChannelRepository
	policyRepo      domain.SecurityPolicyRepository
	ssoProviderRepo domain.SSOProviderRepository
	permRepo        domain.PermissionRepository
	authRepo        domain.AuthHistoryRepository
	jwt             *jwtpkg.Service
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
	SessionTTLMinutes int
	TrustedDeviceTTL  int
	RefreshTTLMinutes int
}

type securityPolicyConfig struct {
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

func NewAuthUsecase(
	userRepo domain.UserRepository,
	tokenRepo domain.TokenRepository,
	clientRepo domain.ClientRepository,
	channelRepo domain.LoginChannelRepository,
	policyRepo domain.SecurityPolicyRepository,
	permRepo domain.PermissionRepository,
	authRepo domain.AuthHistoryRepository,
	jwt *jwtpkg.Service,
	providerRepos ...domain.SSOProviderRepository,
) *AuthUsecase {
	var providerRepo domain.SSOProviderRepository
	if len(providerRepos) > 0 {
		providerRepo = providerRepos[0]
	}
	return &AuthUsecase{
		userRepo:        userRepo,
		tokenRepo:       tokenRepo,
		clientRepo:      clientRepo,
		channelRepo:     channelRepo,
		policyRepo:      policyRepo,
		ssoProviderRepo: providerRepo,
		permRepo:        permRepo,
		authRepo:        authRepo,
		jwt:             jwt,
	}
}

func (uc *AuthUsecase) Login(req *LoginRequest) (*LoginResponse, error) {
	now := time.Now()
	ipKey := ratelimit.Normalize("login_ip", req.IPAddress)
	identityKey := ratelimit.Normalize("login_identity", req.IPAddress, req.Username)
	preLoginPolicy := uc.resolvePolicy("auth", strings.TrimSpace(req.ClientID), strings.TrimSpace(req.Channel))
	ipLimiter, identityLimiter := getLoginLimiters(preLoginPolicy)
	if err := ipLimiter.Allow(ipKey, now); err != nil {
		uc.recordLoginHistory(0, req.Username, req.IPAddress, req.UserAgent, "blocked", "Rate limit theo IP")
		return nil, errors.New("quá nhiều lần đăng nhập từ IP này, vui lòng thử lại sau")
	}
	if err := identityLimiter.Allow(identityKey, now); err != nil {
		uc.recordLoginHistory(0, req.Username, req.IPAddress, req.UserAgent, "blocked", "Rate limit theo tài khoản/IP")
		return nil, errors.New("đăng nhập bị giới hạn tạm thời do quá nhiều lần thất bại")
	}
	user, err := uc.userRepo.FindByUsername(context.Background(), req.Username)
	if err != nil {
		ipLimiter.RegisterFailure(ipKey, now)
		identityLimiter.RegisterFailure(identityKey, now)
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
		_ = uc.userRepo.Save(context.Background(), user)
	}
	if user.IsLocked() {
		uc.recordLoginHistory(user.ID, req.Username, req.IPAddress, req.UserAgent, "locked", "Tài khoản đang bị khóa")
		return nil, ErrAccountLocked
	}
	client, loginChannel, deviceName, deviceFingerprint, err := uc.validateClientAccess(user, req)
	if err != nil {
		uc.recordLoginHistory(user.ID, req.Username, req.IPAddress, req.UserAgent, "failed", err.Error())
		return nil, err
	}
	passwordOK, needsRehash, err := passwordsvc.Verify(user.PasswordHash, req.Password)
	if err != nil || !passwordOK {
		ipLimiter.RegisterFailure(ipKey, now)
		identityLimiter.RegisterFailure(identityKey, now)
		failed := user.FailedLogins + 1
		var lockUntil *time.Time
		note := "Sai mật khẩu"
		if failed >= maxFailedLogins {
			t := time.Now().Add(30 * time.Minute)
			lockUntil = &t
			note = "Sai mật khẩu quá nhiều lần - Khóa tài khoản"
		}
		uc.userRepo.UpdateFailedLogin(context.Background(), user.ID, failed, lockUntil)
		uc.recordLoginHistory(user.ID, req.Username, req.IPAddress, req.UserAgent, "failed", note)
		if lockUntil != nil {
			return nil, ErrAccountLocked
		}
		return nil, ErrInvalidCredentials
	}
	trustedDevice := false
	if deviceFingerprint != "" {
		if _, err := uc.tokenRepo.FindTrustedDevice(context.Background(), user.ID, client.ClientID, deviceFingerprint); err == nil {
			trustedDevice = true
		}
	}
	loginPolicy := uc.resolvePolicy("auth", client.ClientID, loginChannel.Code)
	channelRequiresMFA := loginChannel != nil && loginChannel.RequireMFA
	if loginPolicy != nil && loginPolicy.RequireMFA != nil {
		channelRequiresMFA = *loginPolicy.RequireMFA
	}
	if user.TwoFactorEnabled {
		if strings.TrimSpace(req.OTPCode) == "" {
			uc.recordLoginHistory(user.ID, req.Username, req.IPAddress, req.UserAgent, "failed", "Thiếu mã TOTP")
			return nil, ErrOTPRequired
		}
		if !totpsvc.ValidateCode(user.TOTPSecret, strings.TrimSpace(req.OTPCode), time.Now()) {
			ipLimiter.RegisterFailure(ipKey, now)
			identityLimiter.RegisterFailure(identityKey, now)
			uc.recordLoginHistory(user.ID, req.Username, req.IPAddress, req.UserAgent, "failed", "Mã TOTP không hợp lệ")
			return nil, errors.New("mã OTP không hợp lệ")
		}
	} else if (user.RequireOTP || channelRequiresMFA) && !trustedDevice {
		if strings.TrimSpace(req.OTPCode) == "" {
			if err := uc.issueEmailOTP(user, "login"); err != nil {
				return nil, err
			}
			uc.recordLoginHistory(user.ID, req.Username, req.IPAddress, req.UserAgent, "failed", "Đã gửi email OTP cho thiết bị mới hoặc không tin cậy")
			return nil, ErrOTPRequired
		}
		if !verifyOneTimeCode(user.EmailOTPHash, user.EmailOTPExpiresAt, strings.TrimSpace(req.OTPCode)) {
			ipLimiter.RegisterFailure(ipKey, now)
			identityLimiter.RegisterFailure(identityKey, now)
			uc.recordLoginHistory(user.ID, req.Username, req.IPAddress, req.UserAgent, "failed", "Email OTP không hợp lệ")
			return nil, errors.New("mã OTP không hợp lệ")
		}
		user.EmailOTPHash = ""
		user.EmailOTPExpiresAt = nil
		_ = uc.userRepo.Save(context.Background(), user)
	}
	ipLimiter.Reset(ipKey)
	identityLimiter.Reset(identityKey)
	if needsRehash {
		if rehashed, hashErr := passwordsvc.Hash(req.Password); hashErr == nil {
			user.PasswordHash = rehashed
			user.PasswordHistory = appendPasswordHistory(user.PasswordHistory, rehashed)
			_ = uc.userRepo.Save(context.Background(), user)
		}
	}
	uc.userRepo.UpdateLastLogin(context.Background(), user.ID)
	uc.recordLoginHistory(user.ID, req.Username, req.IPAddress, req.UserAgent, "success", "")
	return uc.buildLoginResponse(user, sessionContext{
		SessionID:         generateOpaqueID(16),
		TokenFamily:       generateOpaqueID(16),
		ClientID:          client.ClientID,
		Audiences:         cloneStrings(client.Audiences),
		DeviceName:        fmt.Sprintf("%s [%s]", deviceName, loginChannel.Code),
		DeviceFingerprint: deviceFingerprint,
		IPAddress:         req.IPAddress,
		UserAgent:         req.UserAgent,
		Trusted:           trustedDevice || req.TrustDevice,
		SessionTTLMinutes: policyInt(loginPolicy, "session"),
		TrustedDeviceTTL:  policyInt(loginPolicy, "trusted"),
		RefreshTTLMinutes: policyInt(loginPolicy, "refresh"),
	})
}

func (uc *AuthUsecase) resolvePolicy(policyType, clientID, channel string) *securityPolicyConfig {
	return resolvePolicyConfig(context.Background(), uc.policyRepo, policyType, clientID, channel)
}

func (uc *AuthUsecase) resolvePasswordPolicy(clientID string) *securityPolicyConfig {
	return resolvePolicyConfig(context.Background(), uc.policyRepo, "password", clientID, "")
}

func (uc *AuthUsecase) ListSSOProviders() []sso.Provider {
	if uc.ssoProviderRepo != nil {
		providers, total, err := uc.ssoProviderRepo.List(context.Background(), map[string]interface{}{
			"page":      1,
			"page_size": 100,
		})
		if err == nil && total > 0 {
			result := make([]sso.Provider, 0, len(providers))
			for _, provider := range providers {
				if provider.Enabled {
					result = append(result, domainToSSOProvider(provider))
				}
			}
			return result
		}
	}
	return sso.List()
}

func (uc *AuthUsecase) StartSSO(providerID string) (string, error) {
	provider, err := uc.resolveSSOProvider(providerID)
	if err != nil {
		return "", err
	}
	redirectURL, _, err := sso.StartURLForProvider(*provider)
	return redirectURL, err
}

func (uc *AuthUsecase) resolveSSOProvider(providerID string) (*sso.Provider, error) {
	if uc.ssoProviderRepo != nil {
		provider, err := uc.ssoProviderRepo.FindByProviderID(context.Background(), strings.TrimSpace(providerID))
		if err == nil {
			if !provider.Enabled {
				return nil, errors.New("provider SSO đang bị vô hiệu hóa")
			}
			resolved := domainToSSOProvider(provider)
			return &resolved, nil
		}
	}
	for _, provider := range sso.List() {
		if provider.ID == strings.TrimSpace(providerID) {
			cloned := provider
			return &cloned, nil
		}
	}
	return nil, errors.New("provider SSO không tồn tại hoặc chưa được cấu hình")
}

func (uc *AuthUsecase) recordLoginHistory(userID uint, username, ip, ua, status, note string) {
	_ = uc.authRepo.Save(context.Background(), &domain.AuthHistory{
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
	stored, err := uc.tokenRepo.FindByToken(context.Background(), refreshTokenStr)
	if err != nil || stored.ExpiresAt.Before(time.Now()) {
		return nil, ErrTokenRevoked
	}
	if stored.Revoked {
		if stored.TokenFamily != "" {
			_ = uc.tokenRepo.RevokeFamily(context.Background(), stored.TokenFamily, "refresh_token_reuse_detected")
		}
		return nil, ErrTokenRevoked
	}
	_ = uc.tokenRepo.RevokeToken(context.Background(), refreshTokenStr)

	user, err := uc.userRepo.FindByID(context.Background(), claims.UserID)
	if err != nil {
		return nil, ErrTokenRevoked
	}
	audiences := []string{}
	refreshPolicy := uc.resolvePolicy("auth", stored.ClientID, "")
	if uc.clientRepo != nil && stored.ClientID != "" {
		if client, clientErr := uc.clientRepo.FindByClientID(context.Background(), stored.ClientID); clientErr == nil {
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
		SessionTTLMinutes: policyInt(refreshPolicy, "session"),
		TrustedDeviceTTL:  policyInt(refreshPolicy, "trusted"),
		RefreshTTLMinutes: policyInt(refreshPolicy, "refresh"),
	})
}

func (uc *AuthUsecase) IssueClientToken(clientID, clientSecret, grantType string) (*ClientTokenResponse, error) {
	if uc.clientRepo == nil {
		return nil, errors.New("client registry chưa sẵn sàng")
	}
	client, err := uc.clientRepo.FindByClientID(context.Background(), strings.TrimSpace(clientID))
	if err != nil || !client.Active {
		return nil, errors.New("client không tồn tại hoặc đã bị vô hiệu")
	}
	if client.ApprovalStatus != "" && client.ApprovalStatus != "approved" {
		return nil, errors.New("client chưa được approval để cấp token")
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
	if client.SecretExpiresAt != nil && client.SecretExpiresAt.Before(time.Now()) {
		return nil, errors.New("client_secret đã hết hạn, cần rotate secret")
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
	client, err := uc.clientRepo.FindByClientID(context.Background(), strings.TrimSpace(clientID))
	if err != nil || !client.Active {
		return nil, errors.New("client không tồn tại hoặc đã bị vô hiệu")
	}
	if client.ApprovalStatus != "" && client.ApprovalStatus != "approved" {
		return nil, errors.New("client chưa được approval để thực hiện authorization flow")
	}
	if !client.Public && strings.TrimSpace(clientSecret) != client.ClientSecret {
		return nil, errors.New("client_secret không hợp lệ")
	}
	if !client.Public && client.SecretExpiresAt != nil && client.SecretExpiresAt.Before(time.Now()) {
		return nil, errors.New("client_secret đã hết hạn, cần rotate secret")
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
	client, err := uc.clientRepo.FindByClientID(context.Background(), strings.TrimSpace(req.ClientID))
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
	provider, err := uc.resolveSSOProvider(providerID)
	if err != nil {
		return nil, err
	}
	identity, err := sso.CompleteWithProvider(*provider, state, code)
	if err != nil {
		return nil, err
	}
	user, err := uc.findOrProvisionSSOUser(identity, provider.AllowAutoProvision)
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
		_ = uc.userRepo.Save(context.Background(), user)
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
	client, loginChannel, deviceName, deviceFingerprint, err := uc.validateClientAccess(user, loginReq)
	if err != nil {
		uc.recordLoginHistory(user.ID, user.Username, req.IPAddress, req.UserAgent, "failed", err.Error())
		return nil, err
	}
	trustedDevice := false
	if deviceFingerprint != "" {
		if _, err := uc.tokenRepo.FindTrustedDevice(context.Background(), user.ID, client.ClientID, deviceFingerprint); err == nil {
			trustedDevice = true
		}
	}
	loginPolicy := uc.resolvePolicy("auth", client.ClientID, loginChannel.Code)
	channelRequiresMFA := loginChannel != nil && loginChannel.RequireMFA
	if loginPolicy != nil && loginPolicy.RequireMFA != nil {
		channelRequiresMFA = *loginPolicy.RequireMFA
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
	} else if (user.RequireOTP || channelRequiresMFA) && !trustedDevice {
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
		_ = uc.userRepo.Save(context.Background(), user)
	}
	_ = uc.userRepo.UpdateLastLogin(context.Background(), user.ID)
	uc.recordLoginHistory(user.ID, user.Username, req.IPAddress, req.UserAgent, "success", "sso:"+providerID)
	return uc.buildLoginResponse(user, sessionContext{
		SessionID:         generateOpaqueID(16),
		TokenFamily:       generateOpaqueID(16),
		ClientID:          client.ClientID,
		Audiences:         cloneStrings(client.Audiences),
		DeviceName:        fmt.Sprintf("%s [%s]", deviceName, loginChannel.Code),
		DeviceFingerprint: deviceFingerprint,
		IPAddress:         req.IPAddress,
		UserAgent:         req.UserAgent,
		Trusted:           trustedDevice || req.TrustDevice,
		SessionTTLMinutes: policyInt(loginPolicy, "session"),
		TrustedDeviceTTL:  policyInt(loginPolicy, "trusted"),
		RefreshTTLMinutes: policyInt(loginPolicy, "refresh"),
	})
}

func (uc *AuthUsecase) Logout(userID uint, sessionID string) error {
	if sessionID != "" {
		return uc.tokenRepo.RevokeSession(context.Background(), userID, sessionID)
	}
	return uc.tokenRepo.RevokeByUserID(context.Background(), userID)
}

func (uc *AuthUsecase) Me(userID uint) (*UserInfo, error) {
	user, err := uc.userRepo.FindByID(context.Background(), userID)
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
	user, err := uc.userRepo.FindByID(context.Background(), userID)
	if err != nil {
		return errors.New("người dùng không tồn tại")
	}
	passwordOK, _, verifyErr := passwordsvc.Verify(user.PasswordHash, oldPw)
	if verifyErr != nil || !passwordOK {
		return errors.New("mật khẩu cũ không đúng")
	}
	if err := validatePasswordPolicy(user, newPw, uc.resolvePasswordPolicy("")); err != nil {
		return err
	}
	hash, _ := passwordsvc.Hash(newPw)
	user.PasswordHash = string(hash)
	user.PasswordHistory = appendPasswordHistory(user.PasswordHistory, user.PasswordHash)
	user.OneTimePassword = false
	if user.PasswordExpiresAt != nil && !user.PasswordExpiresAt.After(time.Now()) {
		user.PasswordExpiresAt = nil
	}
	uc.tokenRepo.RevokeByUserID(context.Background(), userID)
	return uc.userRepo.Save(context.Background(), user)
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
	if session.RefreshTTLMinutes > 0 {
		customRefreshExpiry := time.Now().Add(time.Duration(session.RefreshTTLMinutes) * time.Minute)
		if customRefreshExpiry.Before(expiry) {
			expiry = customRefreshExpiry
		}
	}
	if session.SessionTTLMinutes > 0 {
		customExpiry := time.Now().Add(time.Duration(session.SessionTTLMinutes) * time.Minute)
		if customExpiry.Before(expiry) {
			expiry = customExpiry
		}
	}
	if session.Trusted && session.TrustedDeviceTTL > 0 {
		trustedExpiry := time.Now().Add(time.Duration(session.TrustedDeviceTTL) * time.Hour)
		if trustedExpiry.Before(expiry) {
			expiry = trustedExpiry
		}
	}
	uc.tokenRepo.Save(context.Background(), &domain.RefreshToken{
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

type DeviceListResponse = PaginatedResult[DeviceListItem]

type Setup2FAResponse struct {
	Secret    string `json:"secret"`
	QRCodeURL string `json:"qr_code_url"`
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

func (uc *AuthUsecase) ListSessions(userID uint, currentSessionID string) ([]SessionResponse, error) {
	sessions, err := uc.tokenRepo.ListActiveSessions(context.Background(), userID)
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
	return uc.tokenRepo.RevokeSession(context.Background(), userID, sessionID)
}

func (uc *AuthUsecase) RevokeAllSessions(userID uint) error {
	return uc.tokenRepo.RevokeByUserID(context.Background(), userID)
}

func (uc *AuthUsecase) ListDevices(filters map[string]interface{}) (*DeviceListResponse, error) {
	sessions, total, err := uc.tokenRepo.ListSessions(context.Background(), filters)
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
	return uc.tokenRepo.RevokeSessionByID(context.Background(), sessionID)
}

func (uc *AuthUsecase) Setup2FA(userID uint) (*Setup2FAResponse, error) {
	user, err := uc.userRepo.FindByID(context.Background(), userID)
	if err != nil {
		return nil, errors.New("người dùng không tồn tại")
	}
	secret, err := totpsvc.GenerateSecret()
	if err != nil {
		return nil, err
	}
	user.PendingTOTPSecret = secret
	if err := uc.userRepo.Save(context.Background(), user); err != nil {
		return nil, err
	}
	otpAuth := totpsvc.BuildOTPAuthURL("AMS", user.Email, secret)
	return &Setup2FAResponse{
		Secret:    secret,
		QRCodeURL: "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=" + url.QueryEscape(otpAuth),
	}, nil
}

func (uc *AuthUsecase) Verify2FA(userID uint, code string) error {
	user, err := uc.userRepo.FindByID(context.Background(), userID)
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
	return uc.userRepo.Save(context.Background(), user)
}

func (uc *AuthUsecase) Disable2FA(userID uint) error {
	user, err := uc.userRepo.FindByID(context.Background(), userID)
	if err != nil {
		return errors.New("người dùng không tồn tại")
	}
	user.TwoFactorEnabled = false
	user.TOTPSecret = ""
	user.PendingTOTPSecret = ""
	return uc.userRepo.Save(context.Background(), user)
}

func (uc *AuthUsecase) StepUp(userID uint, sessionID, clientID, password, otpCode string) (*StepUpResponse, error) {
	user, err := uc.userRepo.FindByID(context.Background(), userID)
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
		if err := uc.userRepo.Save(context.Background(), user); err != nil {
			return nil, err
		}
	}
	stepUpTTL := 10 * time.Minute
	if authPolicy := uc.resolvePolicy("auth", clientID, ""); authPolicy != nil && authPolicy.StepUpTTLMinutes != nil && *authPolicy.StepUpTTLMinutes > 0 {
		stepUpTTL = time.Duration(*authPolicy.StepUpTTLMinutes) * time.Minute
	}
	token, expiresAt, err := uc.jwt.GenerateStepUpToken(user.ID, user.Username, sessionID, clientID, stepUpTTL)
	if err != nil {
		return nil, err
	}
	return &StepUpResponse{StepUpToken: token, ExpiresAt: expiresAt}, nil
}

func (uc *AuthUsecase) ForgotPassword(email string) error {
	user, err := uc.userRepo.FindByEmail(context.Background(), email)
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

	user, err := uc.userRepo.FindByID(context.Background(), userID)
	if err != nil {
		return errors.New("người dùng không tồn tại")
	}
	if err := validatePasswordPolicy(user, newPassword, uc.resolvePasswordPolicy("")); err != nil {
		return err
	}
	hash, _ := passwordsvc.Hash(newPassword)
	user.PasswordHash = string(hash)
	user.PasswordHistory = appendPasswordHistory(user.PasswordHistory, user.PasswordHash)
	user.OneTimePassword = false

	if err := uc.userRepo.Save(context.Background(), user); err != nil {
		return err
	}

	// Remove token after use
	mockResetTokens.Lock()
	delete(mockResetTokens.m, token)
	mockResetTokens.Unlock()

	// Revoke all existing sessions
	uc.tokenRepo.RevokeByUserID(context.Background(), user.ID)
	return nil
}

func (uc *AuthUsecase) SendVerificationEmail(userID uint) error {
	user, err := uc.userRepo.FindByID(context.Background(), userID)
	if err != nil {
		return errors.New("người dùng không tồn tại")
	}
	otp := generateNumericCode()
	expiry := time.Now().Add(15 * time.Minute)
	user.EmailVerifyHash = hashOneTimeCode(otp)
	user.EmailVerifyExpiry = &expiry
	if err := uc.userRepo.Save(context.Background(), user); err != nil {
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
	user, err := uc.userRepo.FindByID(context.Background(), uint(userID64))
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
	if err := uc.userRepo.Save(context.Background(), user); err != nil {
		return err
	}
	return nil
}

func (uc *AuthUsecase) validateClientAccess(user *domain.User, req *LoginRequest) (*domain.AuthClient, *domain.LoginChannel, string, string, error) {
	clientID := strings.TrimSpace(req.ClientID)
	if clientID == "" {
		clientID = "web_portal"
	}
	if uc.clientRepo == nil {
		return nil, nil, "", "", errors.New("client registry chưa sẵn sàng")
	}
	client, err := uc.clientRepo.FindByClientID(context.Background(), clientID)
	if err != nil || !client.Active {
		return nil, nil, "", "", errors.New("client_id không hợp lệ hoặc chưa được đăng ký")
	}
	if client.ApprovalStatus != "" && client.ApprovalStatus != "approved" {
		return nil, nil, "", "", errors.New("client chưa được approval")
	}
	grantType := strings.TrimSpace(req.GrantType)
	if grantType == "" {
		grantType = "password"
	}
	if !containsOrEmpty(client.GrantTypes, grantType) {
		return nil, nil, "", "", errors.New("grant_type không được hỗ trợ cho client này")
	}
	if grantType == "password" && !client.LegacyPasswordGrant {
		return nil, nil, "", "", errors.New("password grant chỉ còn hỗ trợ cho legacy client")
	}
	if !client.Public && strings.TrimSpace(req.ClientSecret) != client.ClientSecret {
		return nil, nil, "", "", errors.New("client_secret không hợp lệ")
	}
	if !client.Public && client.SecretExpiresAt != nil && client.SecretExpiresAt.Before(time.Now()) {
		return nil, nil, "", "", errors.New("client_secret đã hết hạn, cần rotate secret")
	}
	channel := strings.TrimSpace(req.Channel)
	if channel == "" && len(client.Channels) > 0 {
		channel = client.Channels[0]
	}
	if !containsOrEmpty(client.Channels, channel) {
		return nil, nil, "", "", errors.New("channel không hợp lệ cho client này")
	}
	if !containsOrEmpty(user.AllowedClients, clientID) {
		return nil, nil, "", "", errors.New("tài khoản này không được phép đăng nhập vào client hiện tại")
	}
	if !containsOrEmpty(user.AllowedChannels, channel) {
		return nil, nil, "", "", errors.New("tài khoản này không được phép đăng nhập qua kênh hiện tại")
	}
	loginChannel := &domain.LoginChannel{Code: channel, Name: channel, Active: true, AllowPassword: true, AllowSSO: true}
	if uc.channelRepo != nil {
		resolved, channelErr := uc.channelRepo.FindByCode(context.Background(), channel)
		if channelErr != nil {
			return nil, nil, "", "", errors.New("login channel không tồn tại hoặc chưa được cấu hình")
		}
		if !resolved.Active {
			return nil, nil, "", "", errors.New("login channel đang bị vô hiệu hóa")
		}
		if grantType == "password" && !resolved.AllowPassword {
			return nil, nil, "", "", errors.New("login channel này không cho phép password login")
		}
		if grantType == "authorization_code" && !resolved.AllowSSO {
			return nil, nil, "", "", errors.New("login channel này không cho phép SSO login")
		}
		loginChannel = resolved
	}
	authPolicy := uc.resolvePolicy("auth", client.ClientID, channel)
	if grantType == "password" && authPolicy != nil && authPolicy.AllowPassword != nil && !*authPolicy.AllowPassword {
		return nil, nil, "", "", errors.New("security policy hiện tại không cho phép password login")
	}
	if grantType == "authorization_code" && authPolicy != nil && authPolicy.AllowSSO != nil && !*authPolicy.AllowSSO {
		return nil, nil, "", "", errors.New("security policy hiện tại không cho phép SSO login")
	}
	deviceName := strings.TrimSpace(req.DeviceName)
	if deviceName == "" {
		deviceName = "Unknown device"
	}
	deviceFingerprint := strings.TrimSpace(req.DeviceFingerprint)
	if deviceFingerprint == "" {
		deviceFingerprint = fmt.Sprintf("%s|%s|%s", clientID, req.IPAddress, req.UserAgent)
	}
	return client, loginChannel, deviceName, deviceFingerprint, nil
}

func (uc *AuthUsecase) issueEmailOTP(user *domain.User, reason string) error {
	otp := generateNumericCode()
	expiry := time.Now().Add(10 * time.Minute)
	user.EmailOTPHash = hashOneTimeCode(otp)
	user.EmailOTPExpiresAt = &expiry
	if err := uc.userRepo.Save(context.Background(), user); err != nil {
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

func (uc *AuthUsecase) findOrProvisionSSOUser(identity *sso.Identity, allowAutoProvision bool) (*domain.User, error) {
	user, err := uc.userRepo.FindByEmail(context.Background(), identity.Email)
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
			if saveErr := uc.userRepo.Save(context.Background(), user); saveErr != nil {
				return nil, saveErr
			}
		}
		return user, nil
	}
	if !allowAutoProvision {
		return nil, errors.New("tài khoản chưa được liên kết với SSO provider này")
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
	if err := uc.userRepo.Save(context.Background(), user); err != nil {
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
	users, _, err := uc.userRepo.List(context.Background(), nil)
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

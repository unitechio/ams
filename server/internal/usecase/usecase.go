package usecase

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/owner/auth-server/internal/authorization/permission"
	"github.com/owner/auth-server/internal/domain"
	passwordsvc "github.com/owner/auth-server/internal/security/password"
	"github.com/owner/auth-server/internal/security/ratelimit"
	"github.com/owner/auth-server/internal/security/sso"
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
	policyRateLimiters   = struct {
		sync.Mutex
		m map[string]*ratelimit.Limiter
	}{m: make(map[string]*ratelimit.Limiter)}
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

func validatePasswordPolicy(user *domain.User, password string, policy *securityPolicyConfig) error {
	minLength := 8
	requireUpper := true
	requireLower := true
	requireNumber := true
	requireSpecial := true
	if policy != nil {
		if policy.PasswordMinLength != nil && *policy.PasswordMinLength > 0 {
			minLength = *policy.PasswordMinLength
		}
		if policy.RequireUpper != nil {
			requireUpper = *policy.RequireUpper
		}
		if policy.RequireLower != nil {
			requireLower = *policy.RequireLower
		}
		if policy.RequireNumber != nil {
			requireNumber = *policy.RequireNumber
		}
		if policy.RequireSpecial != nil {
			requireSpecial = *policy.RequireSpecial
		}
	}
	if len(password) < minLength {
		return fmt.Errorf("mật khẩu phải có ít nhất %d ký tự", minLength)
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

	if (requireUpper && !hasUpper) || (requireLower && !hasLower) || (requireNumber && !hasDigit) || (requireSpecial && !hasSpecial) {
		return ErrPasswordPolicyInvalid
	}

	if user.PasswordHash != "" {
		if ok, _, err := passwordsvc.Verify(user.PasswordHash, password); err == nil && ok {
			return ErrPasswordReused
		}
	}

	for _, oldHash := range user.PasswordHistory {
		if ok, _, err := passwordsvc.Verify(oldHash, password); err == nil && ok {
			return ErrPasswordReused
		}
	}

	return nil
}

var (
	ErrPasswordPolicyInvalid = errors.New("Mật khẩu chưa đáp ứng security policy hiện tại")
	ErrPasswordReused        = errors.New("Mật khẩu mới không được trùng với các mật khẩu đã dùng gần đây")
)

func resolvePolicyConfig(ctx context.Context, repo domain.SecurityPolicyRepository, policyType, clientID, channel string) *securityPolicyConfig {
	if repo == nil {
		return nil
	}
	items, _, err := repo.List(ctx, map[string]interface{}{
		"policy_type": policyType,
		"active":      "true",
		"page":        1,
		"page_size":   500,
	})
	if err != nil || len(items) == 0 {
		return nil
	}
	applicable := make([]*domain.SecurityPolicy, 0)
	for _, item := range items {
		if policyApplies(item, clientID, channel) {
			applicable = append(applicable, item)
		}
	}
	if len(applicable) == 0 {
		return nil
	}
	sort.SliceStable(applicable, func(i, j int) bool {
		if applicable[i].Priority == applicable[j].Priority {
			return policySpecificity(applicable[i]) < policySpecificity(applicable[j])
		}
		return applicable[i].Priority < applicable[j].Priority
	})
	merged := &securityPolicyConfig{}
	for _, item := range applicable {
		cfg := parseSecurityPolicyConfig(item.ConfigJSON)
		mergeSecurityPolicyConfig(merged, cfg)
	}
	return merged
}

func policyApplies(item *domain.SecurityPolicy, clientID, channel string) bool {
	switch strings.TrimSpace(item.ScopeType) {
	case "", "global":
		return true
	case "client":
		return strings.EqualFold(strings.TrimSpace(item.TargetClient), strings.TrimSpace(clientID))
	case "channel":
		return strings.EqualFold(strings.TrimSpace(item.TargetChannel), strings.TrimSpace(channel))
	case "client_channel":
		return strings.EqualFold(strings.TrimSpace(item.TargetClient), strings.TrimSpace(clientID)) &&
			strings.EqualFold(strings.TrimSpace(item.TargetChannel), strings.TrimSpace(channel))
	default:
		return false
	}
}

func stepUpPolicyApplies(item *domain.SecurityPolicy, clientID, action string) bool {
	if strings.TrimSpace(item.TargetAction) != "" && !strings.EqualFold(strings.TrimSpace(item.TargetAction), strings.TrimSpace(action)) {
		return false
	}
	switch strings.TrimSpace(item.ScopeType) {
	case "", "global":
		return true
	case "client":
		return strings.EqualFold(strings.TrimSpace(item.TargetClient), strings.TrimSpace(clientID))
	default:
		return false
	}
}

func policySpecificity(item *domain.SecurityPolicy) int {
	switch strings.TrimSpace(item.ScopeType) {
	case "global":
		return 1
	case "client":
		return 2
	case "channel":
		return 3
	case "client_channel":
		return 4
	default:
		return 99
	}
}

func parseSecurityPolicyConfig(raw string) *securityPolicyConfig {
	cfg := &securityPolicyConfig{}
	if strings.TrimSpace(raw) == "" {
		return cfg
	}
	_ = json.Unmarshal([]byte(raw), cfg)
	return cfg
}

func mergeSecurityPolicyConfig(base, next *securityPolicyConfig) {
	if next == nil {
		return
	}
	if next.RequireMFA != nil {
		base.RequireMFA = next.RequireMFA
	}
	if next.RequireStepUp != nil {
		base.RequireStepUp = next.RequireStepUp
	}
	if next.AllowPassword != nil {
		base.AllowPassword = next.AllowPassword
	}
	if next.AllowSSO != nil {
		base.AllowSSO = next.AllowSSO
	}
	if next.TrustedDeviceTTLHours != nil {
		base.TrustedDeviceTTLHours = next.TrustedDeviceTTLHours
	}
	if next.SessionTTLMinutes != nil {
		base.SessionTTLMinutes = next.SessionTTLMinutes
	}
	if next.RefreshTTLMinutes != nil {
		base.RefreshTTLMinutes = next.RefreshTTLMinutes
	}
	if next.StepUpTTLMinutes != nil {
		base.StepUpTTLMinutes = next.StepUpTTLMinutes
	}
	if next.LoginIPMaxAttempts != nil {
		base.LoginIPMaxAttempts = next.LoginIPMaxAttempts
	}
	if next.LoginIPWindowMinutes != nil {
		base.LoginIPWindowMinutes = next.LoginIPWindowMinutes
	}
	if next.LoginIPBlockMinutes != nil {
		base.LoginIPBlockMinutes = next.LoginIPBlockMinutes
	}
	if next.LoginIDMaxAttempts != nil {
		base.LoginIDMaxAttempts = next.LoginIDMaxAttempts
	}
	if next.LoginIDWindowMinutes != nil {
		base.LoginIDWindowMinutes = next.LoginIDWindowMinutes
	}
	if next.LoginIDBlockMinutes != nil {
		base.LoginIDBlockMinutes = next.LoginIDBlockMinutes
	}
	if next.PasswordMinLength != nil {
		base.PasswordMinLength = next.PasswordMinLength
	}
	if next.RequireUpper != nil {
		base.RequireUpper = next.RequireUpper
	}
	if next.RequireLower != nil {
		base.RequireLower = next.RequireLower
	}
	if next.RequireNumber != nil {
		base.RequireNumber = next.RequireNumber
	}
	if next.RequireSpecial != nil {
		base.RequireSpecial = next.RequireSpecial
	}
}

func policyInt(cfg *securityPolicyConfig, kind string) int {
	if cfg == nil {
		return 0
	}
	switch kind {
	case "session":
		if cfg.SessionTTLMinutes != nil {
			return *cfg.SessionTTLMinutes
		}
	case "trusted":
		if cfg.TrustedDeviceTTLHours != nil {
			return *cfg.TrustedDeviceTTLHours
		}
	case "refresh":
		if cfg.RefreshTTLMinutes != nil {
			return *cfg.RefreshTTLMinutes
		}
	}
	return 0
}

func getLoginLimiters(cfg *securityPolicyConfig) (*ratelimit.Limiter, *ratelimit.Limiter) {
	if cfg == nil {
		return loginIPLimiter, loginIdentityLimiter
	}
	ipMax := getOrDefaultInt(cfg.LoginIPMaxAttempts, 20)
	ipWindow := getOrDefaultInt(cfg.LoginIPWindowMinutes, 5)
	ipBlock := getOrDefaultInt(cfg.LoginIPBlockMinutes, 15)
	idMax := getOrDefaultInt(cfg.LoginIDMaxAttempts, 7)
	idWindow := getOrDefaultInt(cfg.LoginIDWindowMinutes, 10)
	idBlock := getOrDefaultInt(cfg.LoginIDBlockMinutes, 30)
	return getPolicyLimiter(fmt.Sprintf("ip:%d:%d:%d", ipMax, ipWindow, ipBlock), ipMax, ipWindow, ipBlock),
		getPolicyLimiter(fmt.Sprintf("id:%d:%d:%d", idMax, idWindow, idBlock), idMax, idWindow, idBlock)
}

func getPolicyLimiter(key string, attempts, windowMinutes, blockMinutes int) *ratelimit.Limiter {
	policyRateLimiters.Lock()
	defer policyRateLimiters.Unlock()
	if existing, ok := policyRateLimiters.m[key]; ok {
		return existing
	}
	created := ratelimit.New(attempts, time.Duration(windowMinutes)*time.Minute, time.Duration(blockMinutes)*time.Minute)
	policyRateLimiters.m[key] = created
	return created
}

func getOrDefaultInt(value *int, fallback int) int {
	if value != nil && *value > 0 {
		return *value
	}
	return fallback
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
	if client.ClientTemplate == "" {
		client.ClientTemplate = "custom"
	}
	if client.AppType == "" {
		client.AppType = "web_app"
	}
	if client.Environment == "" {
		client.Environment = "prod"
	}
	if client.DomainGroup == "" {
		client.DomainGroup = "core"
	}
	if client.ApprovalStatus == "" {
		client.ApprovalStatus = "approved"
	}
	if len(client.GrantTypes) == 0 {
		if client.AppType == "internal_service" {
			client.GrantTypes = []string{"client_credentials"}
		} else {
			client.GrantTypes = []string{"refresh_token", "authorization_code"}
		}
	}
	if len(client.Channels) == 0 {
		switch client.AppType {
		case "mobile_app":
			client.Channels = []string{"mobile"}
		case "internal_service":
			client.Channels = []string{"service"}
		case "partner_api":
			client.Channels = []string{"partner"}
		case "kiosk":
			client.Channels = []string{"kiosk"}
		case "admin_portal":
			client.Channels = []string{"crm"}
		default:
			client.Channels = []string{"web"}
		}
	}
	if len(client.Audiences) == 0 {
		client.Audiences = []string{"default-api"}
	}
	if client.Public {
		client.ClientSecret = ""
		if containsOrEmpty(client.GrantTypes, "authorization_code") {
			client.PKCERequired = true
		}
	}
	if !client.Public && client.ClientSecret == "" {
		client.ClientSecret = generateOpaqueID(32)
	}
	if client.SecretVersion <= 0 {
		client.SecretVersion = 1
	}
	if !client.Public && client.SecretExpiresAt == nil {
		expiry := time.Now().Add(180 * 24 * time.Hour)
		client.SecretExpiresAt = &expiry
	}
}

func applyClientTemplate(client *domain.AuthClient) {
	switch strings.TrimSpace(client.ClientTemplate) {
	case "spa_web":
		if client.AppType == "" {
			client.AppType = "web_app"
		}
		if len(client.Channels) == 0 {
			client.Channels = []string{"web"}
		}
		if len(client.GrantTypes) == 0 {
			client.GrantTypes = []string{"authorization_code", "refresh_token"}
		}
		if len(client.TrustedTypes) == 0 {
			client.TrustedTypes = []string{"browser"}
		}
		client.Public = true
		client.PKCERequired = true
	case "crm_portal":
		if client.AppType == "" {
			client.AppType = "admin_portal"
		}
		if len(client.Channels) == 0 {
			client.Channels = []string{"crm", "web"}
		}
		if len(client.GrantTypes) == 0 {
			client.GrantTypes = []string{"authorization_code", "refresh_token"}
		}
		if len(client.TrustedTypes) == 0 {
			client.TrustedTypes = []string{"browser", "desktop"}
		}
		client.Public = false
	case "mobile_pkce":
		if client.AppType == "" {
			client.AppType = "mobile_app"
		}
		if len(client.Channels) == 0 {
			client.Channels = []string{"mobile"}
		}
		if len(client.GrantTypes) == 0 {
			client.GrantTypes = []string{"authorization_code", "refresh_token"}
		}
		if len(client.TrustedTypes) == 0 {
			client.TrustedTypes = []string{"mobile"}
		}
		client.Public = true
		client.PKCERequired = true
	case "kiosk_public":
		if client.AppType == "" {
			client.AppType = "kiosk"
		}
		if len(client.Channels) == 0 {
			client.Channels = []string{"kiosk"}
		}
		if len(client.GrantTypes) == 0 {
			client.GrantTypes = []string{"authorization_code", "refresh_token"}
		}
		if len(client.TrustedTypes) == 0 {
			client.TrustedTypes = []string{"browser", "device"}
		}
		client.Public = true
		client.PKCERequired = true
	case "service_m2m":
		if client.AppType == "" {
			client.AppType = "internal_service"
		}
		if len(client.Channels) == 0 {
			client.Channels = []string{"service"}
		}
		if len(client.GrantTypes) == 0 {
			client.GrantTypes = []string{"client_credentials"}
		}
		if len(client.TrustedTypes) == 0 {
			client.TrustedTypes = []string{"server"}
		}
		client.Public = false
		client.PKCERequired = false
	case "partner_oidc":
		if client.AppType == "" {
			client.AppType = "partner_api"
		}
		if len(client.Channels) == 0 {
			client.Channels = []string{"partner"}
		}
		if len(client.GrantTypes) == 0 {
			client.GrantTypes = []string{"authorization_code", "refresh_token"}
		}
		if len(client.TrustedTypes) == 0 {
			client.TrustedTypes = []string{"browser", "server"}
		}
		client.Public = false
	case "custom":
	}
}

var (
	ErrClientIDRequired                 = errors.New("client_id là bắt buộc")
	ErrClientIDInvalid                  = errors.New("client_id chỉ được chứa chữ thường, số, dấu chấm, gạch ngang hoặc gạch dưới")
	ErrPublicClientHasSecret            = errors.New("public client không được cấu hình client_secret")
	ErrPasswordGrantNotAllowed          = errors.New("password grant chỉ được phép cho legacy client đã bật cờ legacy_password_grant")
	ErrAuthorizationCodeRequireRedirect = errors.New("authorization_code yêu cầu ít nhất một redirect_uri")
	ErrPublicClientRequirePKCE          = errors.New("public client dùng authorization_code bắt buộc phải bật PKCE")
	ErrPublicClientUseClientCredentials = errors.New("public client không được phép dùng client_credentials")
	ErrClientChannelRequired            = errors.New("client phải được gán ít nhất một login channel")
	ErrClientCredentialRequireApproval  = errors.New("service client phải được approved trước khi dùng client_credentials")
)

func (uc *ClientUsecase) validateClient(client *domain.AuthClient) error {
	if client.ClientID == "" {
		return ErrClientIDRequired
	}
	if !regexp.MustCompile(`^[a-z0-9._-]+$`).MatchString(client.ClientID) {
		return ErrClientIDInvalid
	}
	if client.Public && client.ClientSecret != "" {
		return ErrPublicClientHasSecret
	}
	if containsOrEmpty(client.GrantTypes, "password") && !client.LegacyPasswordGrant {
		return ErrPasswordGrantNotAllowed
	}
	if containsOrEmpty(client.GrantTypes, "authorization_code") {
		if len(client.RedirectURIs) == 0 {
			return ErrAuthorizationCodeRequireRedirect
		}
		if client.Public && !client.PKCERequired {
			return ErrPublicClientRequirePKCE
		}
	}
	if containsOrEmpty(client.GrantTypes, "client_credentials") && client.Public {
		return ErrPublicClientUseClientCredentials
	}
	if len(client.Channels) == 0 {
		return ErrClientChannelRequired
	}
	if uc.channelRepo != nil {
		for _, channelCode := range client.Channels {
			channel, err := uc.channelRepo.FindByCode(context.Background(), channelCode)
			if err != nil {
				return fmt.Errorf("login channel %s không tồn tại", channelCode)
			}
			if !channel.Active {
				return fmt.Errorf("login channel %s đang bị vô hiệu hóa", channelCode)
			}
			if containsOrEmpty(client.GrantTypes, "password") && !channel.AllowPassword {
				return fmt.Errorf("login channel %s không cho phép password grant", channelCode)
			}
			if containsOrEmpty(client.GrantTypes, "authorization_code") && !channel.AllowSSO {
				return fmt.Errorf("login channel %s không cho phép authorization_code / SSO flow", channelCode)
			}
		}
	}
	if client.ApprovalStatus != "approved" && containsOrEmpty(client.GrantTypes, "client_credentials") {
		return ErrClientCredentialRequireApproval
	}
	return nil
}

func normalizeSSOProvider(provider *domain.SSOProvider) {
	if provider.Type == "" {
		provider.Type = "oidc"
	}
	if provider.Scope == "" && provider.Type != "saml" {
		provider.Scope = "openid profile email"
	}
	if provider.Icon == "" {
		provider.Icon = "Shield"
	}
}

func normalizeLoginChannel(channel *domain.LoginChannel) {
	if channel.RiskLevel == "" {
		channel.RiskLevel = MediumLevel
	}
	if channel.TrustedDeviceTTLHours <= 0 {
		channel.TrustedDeviceTTLHours = 720
	}
	if channel.SessionTTLMinutes <= 0 {
		channel.SessionTTLMinutes = 1440
	}
}

const (
	MediumLevel = "medium"
)

const (
	PolicyTypeAuth     = "auth"
	PolicyTypePassword = "password"
	PolicyTypeStepup   = "step_up"
)

func normalizeSecurityPolicy(policy *domain.SecurityPolicy) {
	if policy.PolicyType == "" {
		policy.PolicyType = PolicyTypeAuth
	}
	if policy.ScopeType == "" {
		policy.ScopeType = "global"
	}
	if policy.Priority <= 0 {
		policy.Priority = 100
	}
	if strings.TrimSpace(policy.ConfigJSON) == "" {
		policy.ConfigJSON = "{}"
	}
}

func validateSecurityPolicyDefinition(policy *domain.SecurityPolicy) error {
	switch policy.PolicyType {
	case "auth", "password", "step_up":
	default:
		return errors.New("policy_type không hợp lệ")
	}
	switch policy.ScopeType {
	case "global":
	case "client":
		if strings.TrimSpace(policy.TargetClient) == "" {
			return errors.New("scope client yêu cầu target_client")
		}
	case "channel":
		if strings.TrimSpace(policy.TargetChannel) == "" {
			return errors.New("scope channel yêu cầu target_channel")
		}
	case "client_channel":
		if strings.TrimSpace(policy.TargetClient) == "" || strings.TrimSpace(policy.TargetChannel) == "" {
			return errors.New("scope client_channel yêu cầu cả target_client và target_channel")
		}
	default:
		return errors.New("scope_type không hợp lệ")
	}
	if policy.PolicyType == "step_up" && strings.TrimSpace(policy.TargetAction) == "" {
		return errors.New("step_up policy yêu cầu target_action")
	}
	return nil
}

func normalizeReferenceOption(item *domain.ReferenceOption) {
	item.OptionGroup = strings.TrimSpace(item.OptionGroup)
	item.Value = strings.TrimSpace(item.Value)
	item.Label = strings.TrimSpace(item.Label)
	item.Description = strings.TrimSpace(item.Description)
	item.MetaJSON = strings.TrimSpace(item.MetaJSON)
	if item.SortOrder <= 0 {
		item.SortOrder = 100
	}
	if item.MetaJSON == "" {
		item.MetaJSON = "{}"
	}
}

const ()

func validateReferenceOption(item *domain.ReferenceOption) error {
	if item.OptionGroup == "" {
		return errors.New("option_group là bắt buộc")
	}
	if item.Value == "" {
		return errors.New("value là bắt buộc")
	}
	if item.Label == "" {
		return errors.New("label là bắt buộc")
	}
	if !json.Valid([]byte(item.MetaJSON)) {
		return errors.New("meta_json không phải JSON hợp lệ")
	}
	return nil
}

func policyPayloadToJSON(payload SecurityPolicyRulePayload) (string, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

func clientToResponse(client *domain.AuthClient) ClientResponse {
	return ClientResponse{
		ID:                  client.ID,
		ClientID:            client.ClientID,
		ClientSecret:        client.ClientSecret,
		Name:                client.Name,
		Description:         client.Description,
		AppType:             client.AppType,
		ClientTemplate:      client.ClientTemplate,
		Environment:         client.Environment,
		DomainGroup:         client.DomainGroup,
		OwnerTeam:           client.OwnerTeam,
		Public:              client.Public,
		PKCERequired:        client.PKCERequired,
		Active:              client.Active,
		LegacyPasswordGrant: client.LegacyPasswordGrant,
		ApprovalStatus:      client.ApprovalStatus,
		GrantTypes:          cloneStrings(client.GrantTypes),
		RedirectURIs:        cloneStrings(client.RedirectURIs),
		Audiences:           cloneStrings(client.Audiences),
		Channels:            cloneStrings(client.Channels),
		TrustedTypes:        cloneStrings(client.TrustedTypes),
		Tags:                cloneStrings(client.Tags),
		SecretVersion:       client.SecretVersion,
		SecretRotatedAt:     client.SecretRotatedAt,
		SecretExpiresAt:     client.SecretExpiresAt,
		CreatedAt:           client.CreatedAt,
	}
}

func ssoProviderToResponse(provider *domain.SSOProvider) SSOProviderResponse {
	return SSOProviderResponse{
		ID:                 provider.ID,
		ProviderID:         provider.ProviderID,
		Name:               provider.Name,
		Type:               provider.Type,
		ClientID:           provider.ClientID,
		ClientSecret:       provider.ClientSecret,
		AuthorizeURL:       provider.AuthorizeURL,
		TokenURL:           provider.TokenURL,
		UserInfoURL:        provider.UserInfoURL,
		RedirectURI:        provider.RedirectURI,
		Scope:              provider.Scope,
		SAMLLoginURL:       provider.SAMLLoginURL,
		Enabled:            provider.Enabled,
		AllowAutoProvision: provider.AllowAutoProvision,
		Icon:               provider.Icon,
		CreatedAt:          provider.CreatedAt,
	}
}

func loginChannelToResponse(channel *domain.LoginChannel) LoginChannelResponse {
	return LoginChannelResponse{
		ID:                    channel.ID,
		Code:                  channel.Code,
		Name:                  channel.Name,
		Description:           channel.Description,
		RiskLevel:             channel.RiskLevel,
		RequireMFA:            channel.RequireMFA,
		AllowPassword:         channel.AllowPassword,
		AllowSSO:              channel.AllowSSO,
		TrustedDeviceTTLHours: channel.TrustedDeviceTTLHours,
		SessionTTLMinutes:     channel.SessionTTLMinutes,
		Active:                channel.Active,
		CreatedAt:             channel.CreatedAt,
	}
}

func securityPolicyToResponse(policy *domain.SecurityPolicy) SecurityPolicyResponse {
	cfg := parseSecurityPolicyConfig(policy.ConfigJSON)
	return SecurityPolicyResponse{
		ID:            policy.ID,
		Code:          policy.Code,
		Name:          policy.Name,
		Description:   policy.Description,
		PolicyType:    policy.PolicyType,
		ScopeType:     policy.ScopeType,
		TargetClient:  policy.TargetClient,
		TargetChannel: policy.TargetChannel,
		TargetAction:  policy.TargetAction,
		Priority:      policy.Priority,
		Active:        policy.Active,
		Config: SecurityPolicyRulePayload{
			RequireStepUp:         cfg.RequireStepUp,
			RequireMFA:            cfg.RequireMFA,
			AllowPassword:         cfg.AllowPassword,
			AllowSSO:              cfg.AllowSSO,
			TrustedDeviceTTLHours: cfg.TrustedDeviceTTLHours,
			SessionTTLMinutes:     cfg.SessionTTLMinutes,
			RefreshTTLMinutes:     cfg.RefreshTTLMinutes,
			StepUpTTLMinutes:      cfg.StepUpTTLMinutes,
			LoginIPMaxAttempts:    cfg.LoginIPMaxAttempts,
			LoginIPWindowMinutes:  cfg.LoginIPWindowMinutes,
			LoginIPBlockMinutes:   cfg.LoginIPBlockMinutes,
			LoginIDMaxAttempts:    cfg.LoginIDMaxAttempts,
			LoginIDWindowMinutes:  cfg.LoginIDWindowMinutes,
			LoginIDBlockMinutes:   cfg.LoginIDBlockMinutes,
			PasswordMinLength:     cfg.PasswordMinLength,
			RequireUpper:          cfg.RequireUpper,
			RequireLower:          cfg.RequireLower,
			RequireNumber:         cfg.RequireNumber,
			RequireSpecial:        cfg.RequireSpecial,
		},
		ConfigJSON: policy.ConfigJSON,
		CreatedAt:  policy.CreatedAt,
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

func domainToSSOProvider(provider *domain.SSOProvider) sso.Provider {
	return sso.Provider{
		ID:                 provider.ProviderID,
		Name:               provider.Name,
		Type:               provider.Type,
		AllowAutoProvision: provider.AllowAutoProvision,
		ClientID:           provider.ClientID,
		ClientSecret:       provider.ClientSecret,
		AuthorizeURL:       provider.AuthorizeURL,
		TokenURL:           provider.TokenURL,
		UserInfoURL:        provider.UserInfoURL,
		RedirectURI:        provider.RedirectURI,
		Scope:              provider.Scope,
		SAMLLoginURL:       provider.SAMLLoginURL,
	}
}

package usecase

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/owner/auth-server/internal/domain"
	jwtpkg "github.com/owner/auth-server/internal/jwt"
	passwordsvc "github.com/owner/auth-server/internal/security/password"
	"github.com/owner/auth-server/internal/security/ratelimit"
	ssosvc "github.com/owner/auth-server/internal/security/sso"
	"golang.org/x/crypto/bcrypt"
)

type testUserRepo struct {
	users          map[uint]*domain.User
	lastSaved      *domain.User
	rolesAssigned  []uint
	revokedLockout bool
}

func newtestUserRepo(users ...*domain.User) *testUserRepo {
	store := make(map[uint]*domain.User, len(users))
	for _, user := range users {
		cloned := *user
		cloned.PasswordHistory = append([]string{}, user.PasswordHistory...)
		store[user.ID] = &cloned
	}
	return &testUserRepo{users: store}
}

func (r *testUserRepo) FindByID(ctx context.Context, id uint) (*domain.User, error) {
	user, ok := r.users[id]
	if !ok {
		return nil, errors.New("not found")
	}
	cloned := *user
	cloned.PasswordHistory = append([]string{}, user.PasswordHistory...)
	return &cloned, nil
}

func (r *testUserRepo) FindByUsername(ctx context.Context, username string) (*domain.User, error) {
	for _, user := range r.users {
		if user.Username == username {
			cloned := *user
			cloned.PasswordHistory = append([]string{}, user.PasswordHistory...)
			return &cloned, nil
		}
	}
	return nil, errors.New("not found")
}

func (r *testUserRepo) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
	for _, user := range r.users {
		if user.Email == email {
			cloned := *user
			cloned.PasswordHistory = append([]string{}, user.PasswordHistory...)
			return &cloned, nil
		}
	}
	return nil, errors.New("not found")
}

func (r *testUserRepo) List(ctx context.Context, spec interface{}) ([]*domain.User, int64, error) {
	result := make([]*domain.User, 0, len(r.users))
	for _, user := range r.users {
		cloned := *user
		cloned.PasswordHistory = append([]string{}, user.PasswordHistory...)
		result = append(result, &cloned)
	}
	return result, int64(len(result)), nil
}

func (r *testUserRepo) Save(ctx context.Context, u *domain.User) error {
	if u.ID == 0 {
		u.ID = uint(len(r.users) + 1)
	}
	cloned := *u
	cloned.PasswordHistory = append([]string{}, u.PasswordHistory...)
	r.users[u.ID] = &cloned
	r.lastSaved = &cloned
	return nil
}

func (r *testUserRepo) Delete(ctx context.Context, id uint) error {
	delete(r.users, id)
	return nil
}

func (r *testUserRepo) SetRoles(ctx context.Context, userID uint, roleIDs []uint) error {
	r.rolesAssigned = append([]uint{}, roleIDs...)
	return nil
}

func (r *testUserRepo) UpdateLastLogin(ctx context.Context, userID uint) error {
	user := r.users[userID]
	now := time.Now()
	user.LastLogin = &now
	user.FailedLogins = 0
	user.LockedUntil = nil
	return nil
}

func (r *testUserRepo) UpdateFailedLogin(ctx context.Context, userID uint, count int, lockedUntil *time.Time) error {
	user := r.users[userID]
	user.FailedLogins = count
	user.LockedUntil = lockedUntil
	return nil
}

type testTokenRepo struct {
	saved          []*domain.RefreshToken
	revokedUserID  uint
	revokedFamily  string
	revokedSession string
	byToken        map[string]*domain.RefreshToken
	trustedDevice  *domain.RefreshToken
}

func (r *testTokenRepo) Save(ctx context.Context, t *domain.RefreshToken) error {
	r.saved = append(r.saved, t)
	return nil
}

func (r *testTokenRepo) FindByToken(ctx context.Context, token string) (*domain.RefreshToken, error) {
	if r.byToken != nil {
		if item, ok := r.byToken[token]; ok {
			return item, nil
		}
	}
	return nil, errors.New("not implemented")
}

func (r *testTokenRepo) RevokeByUserID(ctx context.Context, userID uint) error {
	r.revokedUserID = userID
	return nil
}

func (r *testTokenRepo) RevokeToken(ctx context.Context, token string) error {
	return nil
}

func (r *testTokenRepo) RevokeSession(ctx context.Context, userID uint, sessionID string) error {
	r.revokedSession = sessionID
	return nil
}

func (r *testTokenRepo) RevokeSessionByID(ctx context.Context, sessionID string) error {
	r.revokedSession = sessionID
	return nil
}

func (r *testTokenRepo) RevokeFamily(ctx context.Context, familyID string, reason string) error {
	r.revokedFamily = familyID
	return nil
}

func (r *testTokenRepo) ListActiveSessions(ctx context.Context, userID uint) ([]*domain.RefreshToken, error) {
	return nil, nil
}

func (r *testTokenRepo) ListSessions(ctx context.Context, filters map[string]interface{}) ([]*domain.RefreshToken, int64, error) {
	return nil, 0, nil
}

func (r *testTokenRepo) FindTrustedDevice(ctx context.Context, userID uint, clientID, fingerprint string) (*domain.RefreshToken, error) {
	if r.trustedDevice != nil {
		return r.trustedDevice, nil
	}
	return nil, errors.New("not found")
}

type testAuthHistoryRepo struct{ items []*domain.AuthHistory }

type testClientRepo struct {
	clients map[string]*domain.AuthClient
}

type testSSOProviderRepo struct {
	providers map[string]*domain.SSOProvider
}

type testLoginChannelRepo struct {
	channels map[string]*domain.LoginChannel
}

type testSecurityPolicyRepo struct {
	items []*domain.SecurityPolicy
}

func newTestClientRepo() *testClientRepo {
	return &testClientRepo{clients: map[string]*domain.AuthClient{
		"web_portal": {
			ID:                  1,
			ClientID:            "web_portal",
			Name:                "Web Portal",
			Active:              true,
			Public:              true,
			PKCERequired:        true,
			LegacyPasswordGrant: true,
			ApprovalStatus:      "approved",
			GrantTypes:          []string{"password", "refresh_token", "authorization_code"},
			RedirectURIs:        []string{"http://localhost:5173/oauth/callback"},
			Channels:            []string{"web"},
			Audiences:           []string{"web-api"},
			SecretVersion:       1,
		},
		"payment_service": {
			ID:             2,
			ClientID:       "payment_service",
			ClientSecret:   "payment_service_secret",
			Name:           "Payment Service",
			Active:         true,
			Public:         false,
			ApprovalStatus: "approved",
			GrantTypes:     []string{"client_credentials"},
			Channels:       []string{"service"},
			Audiences:      []string{"payment-api"},
			SecretVersion:  1,
		},
		"crm_portal": {
			ID:                  3,
			ClientID:            "crm_portal",
			ClientSecret:        "crm_portal_secret",
			Name:                "CRM Portal",
			Active:              true,
			Public:              false,
			LegacyPasswordGrant: true,
			ApprovalStatus:      "approved",
			GrantTypes:          []string{"password", "refresh_token", "authorization_code"},
			RedirectURIs:        []string{"http://localhost:5173/sso/callback/crm"},
			Channels:            []string{"crm", "web"},
			Audiences:           []string{"crm-api"},
			SecretVersion:       1,
		},
	}}
}

func newTestSSOProviderRepo() *testSSOProviderRepo {
	return &testSSOProviderRepo{providers: map[string]*domain.SSOProvider{
		"db-google": {
			ID:                 1,
			ProviderID:         "db-google",
			Name:               "DB Google",
			Type:               "oidc",
			ClientID:           "db-google-client",
			ClientSecret:       "db-google-secret",
			AuthorizeURL:       "https://db.google/authorize",
			TokenURL:           "https://db.google/token",
			UserInfoURL:        "https://db.google/userinfo",
			RedirectURI:        "http://localhost:5173/sso/callback/db-google",
			Scope:              "openid profile email",
			Enabled:            true,
			AllowAutoProvision: true,
			Icon:               "Chrome",
		},
	}}
}

func newTestLoginChannelRepo() *testLoginChannelRepo {
	return &testLoginChannelRepo{channels: map[string]*domain.LoginChannel{
		"web": {
			ID:                1,
			Code:              "web",
			Name:              "Web",
			RiskLevel:         "medium",
			AllowPassword:     true,
			AllowSSO:          true,
			SessionTTLMinutes: 1440,
			Active:            true,
		},
		"crm": {
			ID:                2,
			Code:              "crm",
			Name:              "CRM",
			RiskLevel:         "high",
			RequireMFA:        true,
			AllowPassword:     true,
			AllowSSO:          true,
			SessionTTLMinutes: 720,
			Active:            true,
		},
		"service": {
			ID:                3,
			Code:              "service",
			Name:              "Service",
			RiskLevel:         "high",
			AllowPassword:     false,
			AllowSSO:          false,
			SessionTTLMinutes: 60,
			Active:            true,
		},
	}}
}

func newTestSecurityPolicyRepo() *testSecurityPolicyRepo {
	return &testSecurityPolicyRepo{items: []*domain.SecurityPolicy{
		{
			ID:         1,
			Code:       "global-auth-default",
			Name:       "Global Auth",
			PolicyType: "auth",
			ScopeType:  "global",
			Priority:   10,
			Active:     true,
			ConfigJSON: `{"session_ttl_minutes":1440,"trusted_device_ttl_hours":720}`,
		},
		{
			ID:         2,
			Code:       "global-password-default",
			Name:       "Global Password",
			PolicyType: "password",
			ScopeType:  "global",
			Priority:   10,
			Active:     true,
			ConfigJSON: `{"password_min_length":8,"require_upper":true,"require_lower":true,"require_number":true,"require_special":true}`,
		},
	}}
}

func (r *testClientRepo) FindByClientID(ctx context.Context, clientID string) (*domain.AuthClient, error) {
	client, ok := r.clients[clientID]
	if !ok {
		return nil, errors.New("not found")
	}
	cloned := *client
	return &cloned, nil
}

func (r *testClientRepo) List(ctx context.Context, filters map[string]interface{}) ([]*domain.AuthClient, int64, error) {
	result := make([]*domain.AuthClient, 0, len(r.clients))
	for _, client := range r.clients {
		cloned := *client
		result = append(result, &cloned)
	}
	return result, int64(len(result)), nil
}

func (r *testClientRepo) Save(ctx context.Context, client *domain.AuthClient) error {
	if client.ID == 0 {
		client.ID = uint(len(r.clients) + 1)
	}
	cloned := *client
	r.clients[client.ClientID] = &cloned
	return nil
}

func (r *testClientRepo) Delete(ctx context.Context, id uint) error {
	for key, client := range r.clients {
		if client.ID == id {
			delete(r.clients, key)
			return nil
		}
	}
	return nil
}

func (r *testSSOProviderRepo) FindByProviderID(ctx context.Context, providerID string) (*domain.SSOProvider, error) {
	provider, ok := r.providers[providerID]
	if !ok {
		return nil, errors.New("not found")
	}
	cloned := *provider
	return &cloned, nil
}

func (r *testSSOProviderRepo) FindByID(ctx context.Context, id uint) (*domain.SSOProvider, error) {
	for _, provider := range r.providers {
		if provider.ID == id {
			cloned := *provider
			return &cloned, nil
		}
	}
	return nil, errors.New("not found")
}

func (r *testSSOProviderRepo) List(ctx context.Context, filters map[string]interface{}) ([]*domain.SSOProvider, int64, error) {
	result := make([]*domain.SSOProvider, 0, len(r.providers))
	for _, provider := range r.providers {
		cloned := *provider
		if enabled, ok := filters["enabled"].(string); ok && enabled != "" {
			expected := strings.EqualFold(enabled, "true")
			if cloned.Enabled != expected {
				continue
			}
		}
		result = append(result, &cloned)
	}
	return result, int64(len(result)), nil
}

func (r *testSSOProviderRepo) Save(ctx context.Context, provider *domain.SSOProvider) error {
	if provider.ID == 0 {
		provider.ID = uint(len(r.providers) + 1)
	}
	cloned := *provider
	r.providers[provider.ProviderID] = &cloned
	return nil
}

func (r *testSSOProviderRepo) Delete(ctx context.Context, id uint) error {
	for key, provider := range r.providers {
		if provider.ID == id {
			delete(r.providers, key)
			break
		}
	}
	return nil
}

func (r *testLoginChannelRepo) FindByCode(ctx context.Context, code string) (*domain.LoginChannel, error) {
	channel, ok := r.channels[code]
	if !ok {
		return nil, errors.New("not found")
	}
	cloned := *channel
	return &cloned, nil
}

func (r *testLoginChannelRepo) List(ctx context.Context, filters map[string]interface{}) ([]*domain.LoginChannel, int64, error) {
	result := make([]*domain.LoginChannel, 0, len(r.channels))
	for _, channel := range r.channels {
		cloned := *channel
		result = append(result, &cloned)
	}
	return result, int64(len(result)), nil
}

func (r *testLoginChannelRepo) Save(ctx context.Context, channel *domain.LoginChannel) error {
	if channel.ID == 0 {
		channel.ID = uint(len(r.channels) + 1)
	}
	cloned := *channel
	r.channels[channel.Code] = &cloned
	return nil
}

func (r *testLoginChannelRepo) Delete(ctx context.Context, id uint) error {
	for key, channel := range r.channels {
		if channel.ID == id {
			delete(r.channels, key)
			break
		}
	}
	return nil
}

func (r *testSecurityPolicyRepo) List(ctx context.Context, filters map[string]interface{}) ([]*domain.SecurityPolicy, int64, error) {
	result := make([]*domain.SecurityPolicy, 0, len(r.items))
	for _, item := range r.items {
		cloned := *item
		if policyType, ok := filters["policy_type"].(string); ok && policyType != "" && !strings.EqualFold(cloned.PolicyType, policyType) {
			continue
		}
		if active, ok := filters["active"].(string); ok && active != "" {
			expected := strings.EqualFold(active, "true")
			if cloned.Active != expected {
				continue
			}
		}
		result = append(result, &cloned)
	}
	return result, int64(len(result)), nil
}

func (r *testSecurityPolicyRepo) Save(ctx context.Context, policy *domain.SecurityPolicy) error {
	if policy.ID == 0 {
		policy.ID = uint(len(r.items) + 1)
	}
	cloned := *policy
	replaced := false
	for i, item := range r.items {
		if item.ID == policy.ID {
			r.items[i] = &cloned
			replaced = true
			break
		}
	}
	if !replaced {
		r.items = append(r.items, &cloned)
	}
	return nil
}

func (r *testSecurityPolicyRepo) Delete(ctx context.Context, id uint) error {
	for i, item := range r.items {
		if item.ID == id {
			r.items = append(r.items[:i], r.items[i+1:]...)
			break
		}
	}
	return nil
}

func (r *testAuthHistoryRepo) Save(ctx context.Context, h *domain.AuthHistory) error {
	r.items = append(r.items, h)
	return nil
}

func (r *testAuthHistoryRepo) List(ctx context.Context, spec interface{}) ([]*domain.AuthHistory, int64, error) {
	return r.items, int64(len(r.items)), nil
}

func hashForTest(t *testing.T, password string) string {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	return string(hash)
}

func TestCreateUserStoresPasswordHistory(t *testing.T) {
	repo := newtestUserRepo()
	uc := NewUserUsecase(repo, nil, newTestSecurityPolicyRepo())

	resp, err := uc.Create(&CreateUserReq{
		Username: "new.user",
		Password: "TempPass@123",
		FullName: "New User",
		Email:    "new@example.com",
	})
	if err != nil {
		t.Fatalf("create user: %v", err)
	}

	saved := repo.users[resp.ID]
	if len(saved.PasswordHistory) != 1 {
		t.Fatalf("expected password history to contain initial password, got %d entries", len(saved.PasswordHistory))
	}
	if ok, _, err := passwordsvc.Verify(saved.PasswordHistory[0], "TempPass@123"); err != nil || !ok {
		t.Fatalf("expected initial password to be stored in password history")
	}
}

func TestChangePasswordClearsOneTimePasswordAndPreventsReuse(t *testing.T) {
	currentHash := hashForTest(t, "TempPass@123")
	userRepo := newtestUserRepo(&domain.User{
		ID:              7,
		Username:        "locked.user",
		PasswordHash:    currentHash,
		PasswordHistory: []string{currentHash},
		OneTimePassword: true,
		Status:          "active",
	})
	tokenRepo := &testTokenRepo{}
	authUC := NewAuthUsecase(userRepo, tokenRepo, newTestClientRepo(), newTestLoginChannelRepo(), newTestSecurityPolicyRepo(), nil, &testAuthHistoryRepo{}, jwtpkg.NewService("secret", time.Minute, time.Hour))

	if err := authUC.ChangePassword(7, "TempPass@123", "TempPass@123"); err == nil {
		t.Fatalf("expected password reuse to be rejected")
	}

	if err := authUC.ChangePassword(7, "TempPass@123", "BetterPass@123"); err != nil {
		t.Fatalf("change password: %v", err)
	}

	updated := userRepo.users[7]
	if updated.OneTimePassword {
		t.Fatalf("expected one_time_password flag to be cleared after successful password change")
	}
	if tokenRepo.revokedUserID != 7 {
		t.Fatalf("expected refresh tokens to be revoked for user 7")
	}
}

func TestResetPasswordMarksAccountAsOneTimePassword(t *testing.T) {
	oldHash := hashForTest(t, "OldPass@123")
	userRepo := newtestUserRepo(&domain.User{
		ID:              12,
		Username:        "reset.user",
		PasswordHash:    oldHash,
		PasswordHistory: []string{oldHash},
		Status:          "active",
	})
	uc := NewUserUsecase(userRepo, &testTokenRepo{}, newTestSecurityPolicyRepo())

	if err := uc.ResetPassword(12, "AdminReset@123", true); err != nil {
		t.Fatalf("reset password: %v", err)
	}

	updated := userRepo.users[12]
	if !updated.OneTimePassword {
		t.Fatalf("expected reset password to mark user for forced password change")
	}
	if len(updated.PasswordHistory) < 2 {
		t.Fatalf("expected reset password to append password history")
	}
}

func TestLoginResponseMarksExpiredPassword(t *testing.T) {
	passwordHash := hashForTest(t, "ExpiredPass@123")
	expiredAt := time.Now().Add(-2 * time.Hour)
	userRepo := newtestUserRepo(&domain.User{
		ID:                20,
		Username:          "expired.user",
		PasswordHash:      passwordHash,
		PasswordHistory:   []string{passwordHash},
		Status:            "active",
		PasswordExpiresAt: &expiredAt,
	})
	tokenRepo := &testTokenRepo{}
	authHistoryRepo := &testAuthHistoryRepo{}
	authUC := NewAuthUsecase(userRepo, tokenRepo, newTestClientRepo(), newTestLoginChannelRepo(), newTestSecurityPolicyRepo(), nil, authHistoryRepo, jwtpkg.NewService("secret", time.Minute, time.Hour))

	resp, err := authUC.Login(&LoginRequest{
		Username:  "expired.user",
		Password:  "ExpiredPass@123",
		IPAddress: "127.0.0.1",
		UserAgent: "go test",
	})
	if err != nil {
		t.Fatalf("login: %v", err)
	}

	if !resp.MustChangePassword || !resp.PasswordExpired {
		t.Fatalf("expected expired password to require password change")
	}
	if resp.PasswordChangeReason != "password_expired" {
		t.Fatalf("expected password change reason to be password_expired, got %q", resp.PasswordChangeReason)
	}
}

func TestLoginUpgradesLegacyBcryptHashToArgon2(t *testing.T) {
	legacyHash := hashForTest(t, "LegacyPass@123")
	userRepo := newtestUserRepo(&domain.User{
		ID:              30,
		Username:        "legacy.user",
		PasswordHash:    legacyHash,
		PasswordHistory: []string{legacyHash},
		Status:          "active",
	})
	authUC := NewAuthUsecase(userRepo, &testTokenRepo{}, newTestClientRepo(), newTestLoginChannelRepo(), newTestSecurityPolicyRepo(), nil, &testAuthHistoryRepo{}, jwtpkg.NewService("secret", time.Minute, time.Hour))

	if _, err := authUC.Login(&LoginRequest{
		Username:  "legacy.user",
		Password:  "LegacyPass@123",
		IPAddress: "127.0.0.1",
		UserAgent: "go test",
	}); err != nil {
		t.Fatalf("login: %v", err)
	}

	updated := userRepo.users[30]
	if updated.PasswordHash == legacyHash {
		t.Fatalf("expected password hash to be upgraded after successful login")
	}
	if ok, _, err := passwordsvc.Verify(updated.PasswordHash, "LegacyPass@123"); err != nil || !ok {
		t.Fatalf("expected upgraded hash to verify")
	}
}

func TestLoginRequiresEmailOTPForUntrustedDevice(t *testing.T) {
	passwordHash := hashForTest(t, "OtpPass@123")
	userRepo := newtestUserRepo(&domain.User{
		ID:              31,
		Username:        "otp.user",
		PasswordHash:    passwordHash,
		RequireOTP:      true,
		Status:          "active",
		Email:           "otp@example.com",
		PasswordHistory: []string{passwordHash},
	})
	authUC := NewAuthUsecase(userRepo, &testTokenRepo{}, newTestClientRepo(), newTestLoginChannelRepo(), newTestSecurityPolicyRepo(), nil, &testAuthHistoryRepo{}, jwtpkg.NewService("secret", time.Minute, time.Hour))

	_, err := authUC.Login(&LoginRequest{
		Username:          "otp.user",
		Password:          "OtpPass@123",
		ClientID:          "web_portal",
		Channel:           "web",
		DeviceFingerprint: "device-1",
		IPAddress:         "127.0.0.1",
		UserAgent:         "go test",
	})
	if !errors.Is(err, ErrOTPRequired) {
		t.Fatalf("expected otp required, got %v", err)
	}
	if userRepo.users[31].EmailOTPHash == "" || userRepo.users[31].EmailOTPExpiresAt == nil {
		t.Fatalf("expected email otp to be generated and persisted")
	}
}

func TestStepUpAcceptsPersistedEmailOTP(t *testing.T) {
	passwordHash := hashForTest(t, "StepUpPass@123")
	expiry := time.Now().Add(5 * time.Minute)
	userRepo := newtestUserRepo(&domain.User{
		ID:                32,
		Username:          "step.user",
		PasswordHash:      passwordHash,
		PasswordHistory:   []string{passwordHash},
		RequireOTP:        true,
		EmailOTPHash:      hashOneTimeCode("123456"),
		EmailOTPExpiresAt: &expiry,
		Status:            "active",
	})
	authUC := NewAuthUsecase(userRepo, &testTokenRepo{}, newTestClientRepo(), newTestLoginChannelRepo(), newTestSecurityPolicyRepo(), nil, &testAuthHistoryRepo{}, jwtpkg.NewService("secret", time.Minute, time.Hour))

	resp, err := authUC.StepUp(32, "session-1", "web_portal", "StepUpPass@123", "123456")
	if err != nil {
		t.Fatalf("step-up: %v", err)
	}
	if resp.StepUpToken == "" {
		t.Fatalf("expected step-up token to be issued")
	}
	if userRepo.users[32].EmailOTPHash != "" {
		t.Fatalf("expected email otp to be cleared after successful step-up")
	}
}

func TestLoginRateLimitBlocksRepeatedFailures(t *testing.T) {
	userRepo := newtestUserRepo()
	authUC := NewAuthUsecase(userRepo, &testTokenRepo{}, newTestClientRepo(), newTestLoginChannelRepo(), newTestSecurityPolicyRepo(), nil, &testAuthHistoryRepo{}, jwtpkg.NewService("secret", time.Minute, time.Hour))
	identityKey := ratelimit.Normalize("login_identity", "127.0.0.1", "rate.user")
	ipKey := ratelimit.Normalize("login_ip", "127.0.0.1")
	loginIdentityLimiter.Reset(identityKey)
	loginIPLimiter.Reset(ipKey)
	defer loginIdentityLimiter.Reset(identityKey)
	defer loginIPLimiter.Reset(ipKey)

	for attempt := 0; attempt < 7; attempt++ {
		_, _ = authUC.Login(&LoginRequest{
			Username:  "rate.user",
			Password:  "WrongPass@123",
			IPAddress: "127.0.0.1",
			UserAgent: "go test",
		})
	}

	_, err := authUC.Login(&LoginRequest{
		Username:  "rate.user",
		Password:  "WrongPass@123",
		IPAddress: "127.0.0.1",
		UserAgent: "go test",
	})
	if err == nil || !strings.Contains(err.Error(), "giới hạn") {
		t.Fatalf("expected rate limit error, got %v", err)
	}
}

func TestAuthorizeCodeAndPKCEExchange(t *testing.T) {
	passwordHash := hashForTest(t, "PkcePass@123")
	userRepo := newtestUserRepo(&domain.User{
		ID:              50,
		Username:        "pkce.user",
		PasswordHash:    passwordHash,
		PasswordHistory: []string{passwordHash},
		Status:          "active",
	})
	authUC := NewAuthUsecase(userRepo, &testTokenRepo{}, newTestClientRepo(), newTestLoginChannelRepo(), newTestSecurityPolicyRepo(), nil, &testAuthHistoryRepo{}, jwtpkg.NewService("secret", 15*time.Minute, time.Hour))

	resp, err := authUC.AuthorizeCode(&AuthorizeCodeRequest{
		Username:            "pkce.user",
		Password:            "PkcePass@123",
		ClientID:            "web_portal",
		RedirectURI:         "http://localhost:5173/oauth/callback",
		CodeChallenge:       "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
		CodeChallengeMethod: "S256",
		Channel:             "web",
		DeviceFingerprint:   "pkce-device",
		IPAddress:           "127.0.0.1",
		UserAgent:           "go test",
	})
	if err != nil {
		t.Fatalf("authorize code: %v", err)
	}
	if resp.Code == "" {
		t.Fatalf("expected authorization code")
	}

	tokenResp, err := authUC.ExchangeAuthorizationCode("web_portal", "", resp.Code, "http://localhost:5173/oauth/callback", "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")
	if err != nil {
		t.Fatalf("exchange auth code: %v", err)
	}
	if tokenResp.AccessToken == "" {
		t.Fatalf("expected access token")
	}
}

func TestCompleteSSOProvisionsUserAndReturnsSession(t *testing.T) {
	providerServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/token":
			if err := r.ParseForm(); err != nil {
				t.Fatalf("parse form: %v", err)
			}
			if got := r.PostForm.Get("code"); got != "provider-code-1" {
				t.Fatalf("unexpected code %q", got)
			}
			_ = json.NewEncoder(w).Encode(map[string]string{
				"access_token": "provider-access-token",
			})
		case "/userinfo":
			if got := r.Header.Get("Authorization"); got != "Bearer provider-access-token" {
				t.Fatalf("unexpected authorization header %q", got)
			}
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"sub":            "google-sub-1",
				"email":          "sso.user@example.com",
				"email_verified": true,
				"name":           "SSO User",
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer providerServer.Close()

	t.Setenv("SSO_GOOGLE_CLIENT_ID", "google-client")
	t.Setenv("SSO_GOOGLE_CLIENT_SECRET", "google-secret")
	t.Setenv("SSO_GOOGLE_REDIRECT_URI", "http://localhost:5173/sso/callback/google")
	t.Setenv("SSO_GOOGLE_AUTHORIZE_URL", providerServer.URL+"/authorize")
	t.Setenv("SSO_GOOGLE_TOKEN_URL", providerServer.URL+"/token")
	t.Setenv("SSO_GOOGLE_USERINFO_URL", providerServer.URL+"/userinfo")

	_, state, err := ssosvc.StartURL("google")
	if err != nil {
		t.Fatalf("start sso: %v", err)
	}

	userRepo := newtestUserRepo()
	tokenRepo := &testTokenRepo{}
	authUC := NewAuthUsecase(userRepo, tokenRepo, newTestClientRepo(), newTestLoginChannelRepo(), newTestSecurityPolicyRepo(), nil, &testAuthHistoryRepo{}, jwtpkg.NewService("secret", 15*time.Minute, time.Hour))

	resp, err := authUC.CompleteSSO("google", "provider-code-1", state, &CompleteSSORequest{
		ClientID:          "web_portal",
		Channel:           "web",
		DeviceName:        "Chrome on Windows",
		DeviceFingerprint: "google-device-1",
		TrustDevice:       true,
		IPAddress:         "127.0.0.1",
		UserAgent:         "go test",
	})
	if err != nil {
		t.Fatalf("complete sso: %v", err)
	}
	if resp.AccessToken == "" || resp.RefreshToken == "" {
		t.Fatalf("expected local session tokens to be issued")
	}
	if resp.User.Email != "sso.user@example.com" {
		t.Fatalf("expected provisioned user email, got %q", resp.User.Email)
	}
	provisioned, err := userRepo.FindByEmail(context.Background(), "sso.user@example.com")
	if err != nil {
		t.Fatalf("expected provisioned user to exist: %v", err)
	}
	if !provisioned.EmailVerified {
		t.Fatalf("expected provisioned SSO user to be marked email verified")
	}
	if !strings.HasPrefix(provisioned.Username, "sso") && !strings.HasPrefix(provisioned.Username, "sso-user") {
		t.Fatalf("expected generated username for SSO user, got %q", provisioned.Username)
	}
}

func TestListSSOProvidersPrefersRepository(t *testing.T) {
	authUC := NewAuthUsecase(newtestUserRepo(), &testTokenRepo{}, newTestClientRepo(), newTestLoginChannelRepo(), newTestSecurityPolicyRepo(), nil, &testAuthHistoryRepo{}, jwtpkg.NewService("secret", time.Minute, time.Hour), newTestSSOProviderRepo())

	providers := authUC.ListSSOProviders()
	if len(providers) != 1 {
		t.Fatalf("expected db-backed providers only, got %d", len(providers))
	}
	if providers[0].ID != "db-google" {
		t.Fatalf("expected provider id db-google, got %q", providers[0].ID)
	}
}

func TestLoginRequiresOTPWhenChannelPolicyRequiresMFA(t *testing.T) {
	passwordHash := hashForTest(t, "CrmPass@123")
	userRepo := newtestUserRepo(&domain.User{
		ID:              77,
		Username:        "crm.user",
		PasswordHash:    passwordHash,
		PasswordHistory: []string{passwordHash},
		Status:          "active",
		Email:           "crm.user@example.com",
	})
	authUC := NewAuthUsecase(userRepo, &testTokenRepo{}, newTestClientRepo(), newTestLoginChannelRepo(), newTestSecurityPolicyRepo(), nil, &testAuthHistoryRepo{}, jwtpkg.NewService("secret", time.Minute, time.Hour))

	_, err := authUC.Login(&LoginRequest{
		Username:          "crm.user",
		Password:          "CrmPass@123",
		ClientID:          "crm_portal",
		ClientSecret:      "crm_portal_secret",
		Channel:           "crm",
		DeviceFingerprint: "crm-device-1",
		IPAddress:         "127.0.0.1",
		UserAgent:         "go test",
	})
	if !errors.Is(err, ErrOTPRequired) {
		t.Fatalf("expected channel MFA to require OTP, got %v", err)
	}
}

func TestLoginRequiresOTPWhenSecurityPolicyRequiresMFA(t *testing.T) {
	passwordHash := hashForTest(t, "PolicyPass@123")
	userRepo := newtestUserRepo(&domain.User{
		ID:              91,
		Username:        "policy.user",
		PasswordHash:    passwordHash,
		PasswordHistory: []string{passwordHash},
		Status:          "active",
		Email:           "policy.user@example.com",
	})
	policyRepo := newTestSecurityPolicyRepo()
	policyRepo.items = append(policyRepo.items, &domain.SecurityPolicy{
		ID:            3,
		Code:          "web-policy-mfa",
		Name:          "Web Policy MFA",
		PolicyType:    "auth",
		ScopeType:     "client_channel",
		TargetClient:  "web_portal",
		TargetChannel: "web",
		Priority:      50,
		Active:        true,
		ConfigJSON:    `{"require_mfa":true}`,
	})
	authUC := NewAuthUsecase(userRepo, &testTokenRepo{}, newTestClientRepo(), newTestLoginChannelRepo(), policyRepo, nil, &testAuthHistoryRepo{}, jwtpkg.NewService("secret", time.Minute, time.Hour))

	_, err := authUC.Login(&LoginRequest{
		Username:          "policy.user",
		Password:          "PolicyPass@123",
		ClientID:          "web_portal",
		Channel:           "web",
		DeviceFingerprint: "policy-device",
		IPAddress:         "127.0.0.1",
		UserAgent:         "go test",
	})
	if !errors.Is(err, ErrOTPRequired) {
		t.Fatalf("expected security policy MFA to require OTP, got %v", err)
	}
}

func TestCreateClientRejectsPasswordGrantWithoutLegacyFlag(t *testing.T) {
	uc := NewClientUsecase(newTestClientRepo(), newTestLoginChannelRepo())

	_, err := uc.Create(&CreateClientReq{
		ClientID:     "tenant.web.prod",
		Name:         "Tenant Web",
		AppType:      "web_app",
		Public:       true,
		GrantTypes:   []string{"password", "refresh_token"},
		Channels:     []string{"web"},
		RedirectURIs: []string{"https://tenant.app/callback"},
	})
	if err == nil || !strings.Contains(err.Error(), "legacy_password_grant") {
		t.Fatalf("expected legacy password grant validation error, got %v", err)
	}
}

func TestCreateClientRejectsUnknownChannel(t *testing.T) {
	uc := NewClientUsecase(newTestClientRepo(), newTestLoginChannelRepo())

	_, err := uc.Create(&CreateClientReq{
		ClientID:       "tenant.partner.prod",
		Name:           "Partner",
		AppType:        "partner_api",
		Public:         false,
		ApprovalStatus: "approved",
		GrantTypes:     []string{"authorization_code", "refresh_token"},
		Channels:       []string{"unknown"},
		RedirectURIs:   []string{"https://partner.app/callback"},
	})
	if err == nil || !strings.Contains(err.Error(), "không tồn tại") {
		t.Fatalf("expected unknown channel validation error, got %v", err)
	}
}

func TestRotateSecretIncrementsVersion(t *testing.T) {
	repo := newTestClientRepo()
	uc := NewClientUsecase(repo, newTestLoginChannelRepo())

	resp, err := uc.RotateSecret(3)
	if err != nil {
		t.Fatalf("rotate secret failed: %v", err)
	}
	if resp.SecretVersion != 2 {
		t.Fatalf("expected secret version 2, got %d", resp.SecretVersion)
	}
	if resp.ClientSecret == "" || resp.ClientSecret == "crm_portal_secret" {
		t.Fatalf("expected rotated secret to be regenerated")
	}
}

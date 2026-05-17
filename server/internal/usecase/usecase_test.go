package usecase

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/owner/auth-server/internal/domain"
	jwtpkg "github.com/owner/auth-server/internal/jwt"
	passwordsvc "github.com/owner/auth-server/internal/security/password"
	"github.com/owner/auth-server/internal/security/ratelimit"
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

func (r *testUserRepo) FindByID(id uint) (*domain.User, error) {
	user, ok := r.users[id]
	if !ok {
		return nil, errors.New("not found")
	}
	cloned := *user
	cloned.PasswordHistory = append([]string{}, user.PasswordHistory...)
	return &cloned, nil
}

func (r *testUserRepo) FindByUsername(username string) (*domain.User, error) {
	for _, user := range r.users {
		if user.Username == username {
			cloned := *user
			cloned.PasswordHistory = append([]string{}, user.PasswordHistory...)
			return &cloned, nil
		}
	}
	return nil, errors.New("not found")
}

func (r *testUserRepo) FindByEmail(email string) (*domain.User, error) {
	for _, user := range r.users {
		if user.Email == email {
			cloned := *user
			cloned.PasswordHistory = append([]string{}, user.PasswordHistory...)
			return &cloned, nil
		}
	}
	return nil, errors.New("not found")
}

func (r *testUserRepo) List(spec interface{}) ([]*domain.User, int64, error) {
	result := make([]*domain.User, 0, len(r.users))
	for _, user := range r.users {
		cloned := *user
		cloned.PasswordHistory = append([]string{}, user.PasswordHistory...)
		result = append(result, &cloned)
	}
	return result, int64(len(result)), nil
}

func (r *testUserRepo) Save(u *domain.User) error {
	if u.ID == 0 {
		u.ID = uint(len(r.users) + 1)
	}
	cloned := *u
	cloned.PasswordHistory = append([]string{}, u.PasswordHistory...)
	r.users[u.ID] = &cloned
	r.lastSaved = &cloned
	return nil
}

func (r *testUserRepo) Delete(id uint) error {
	delete(r.users, id)
	return nil
}

func (r *testUserRepo) SetRoles(userID uint, roleIDs []uint) error {
	r.rolesAssigned = append([]uint{}, roleIDs...)
	return nil
}

func (r *testUserRepo) UpdateLastLogin(userID uint) error {
	user := r.users[userID]
	now := time.Now()
	user.LastLogin = &now
	user.FailedLogins = 0
	user.LockedUntil = nil
	return nil
}

func (r *testUserRepo) UpdateFailedLogin(userID uint, count int, lockedUntil *time.Time) error {
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

func (r *testTokenRepo) Save(t *domain.RefreshToken) error {
	r.saved = append(r.saved, t)
	return nil
}

func (r *testTokenRepo) FindByToken(token string) (*domain.RefreshToken, error) {
	if r.byToken != nil {
		if item, ok := r.byToken[token]; ok {
			return item, nil
		}
	}
	return nil, errors.New("not implemented")
}

func (r *testTokenRepo) RevokeByUserID(userID uint) error {
	r.revokedUserID = userID
	return nil
}

func (r *testTokenRepo) RevokeToken(token string) error {
	return nil
}

func (r *testTokenRepo) RevokeSession(userID uint, sessionID string) error {
	r.revokedSession = sessionID
	return nil
}

func (r *testTokenRepo) RevokeSessionByID(sessionID string) error {
	r.revokedSession = sessionID
	return nil
}

func (r *testTokenRepo) RevokeFamily(familyID string, reason string) error {
	r.revokedFamily = familyID
	return nil
}

func (r *testTokenRepo) ListActiveSessions(userID uint) ([]*domain.RefreshToken, error) {
	return nil, nil
}

func (r *testTokenRepo) ListSessions(filters map[string]interface{}) ([]*domain.RefreshToken, int64, error) {
	return nil, 0, nil
}

func (r *testTokenRepo) FindTrustedDevice(userID uint, clientID, fingerprint string) (*domain.RefreshToken, error) {
	if r.trustedDevice != nil {
		return r.trustedDevice, nil
	}
	return nil, errors.New("not found")
}

type testAuthHistoryRepo struct{ items []*domain.AuthHistory }

type testClientRepo struct {
	clients map[string]*domain.AuthClient
}

func newTestClientRepo() *testClientRepo {
	return &testClientRepo{clients: map[string]*domain.AuthClient{
		"web_portal": {
			ID:           1,
			ClientID:     "web_portal",
			Name:         "Web Portal",
			Active:       true,
			Public:       true,
			PKCERequired: true,
			GrantTypes:   []string{"password", "refresh_token", "authorization_code"},
			RedirectURIs: []string{"http://localhost:5173/oauth/callback"},
			Channels:     []string{"web"},
			Audiences:    []string{"web-api"},
		},
		"payment_service": {
			ID:           2,
			ClientID:     "payment_service",
			ClientSecret: "payment_service_secret",
			Name:         "Payment Service",
			Active:       true,
			Public:       false,
			GrantTypes:   []string{"client_credentials"},
			Channels:     []string{"service"},
			Audiences:    []string{"payment-api"},
		},
	}}
}

func (r *testClientRepo) FindByClientID(clientID string) (*domain.AuthClient, error) {
	client, ok := r.clients[clientID]
	if !ok {
		return nil, errors.New("not found")
	}
	cloned := *client
	return &cloned, nil
}

func (r *testClientRepo) List(filters map[string]interface{}) ([]*domain.AuthClient, int64, error) {
	result := make([]*domain.AuthClient, 0, len(r.clients))
	for _, client := range r.clients {
		cloned := *client
		result = append(result, &cloned)
	}
	return result, int64(len(result)), nil
}

func (r *testClientRepo) Save(client *domain.AuthClient) error {
	if client.ID == 0 {
		client.ID = uint(len(r.clients) + 1)
	}
	cloned := *client
	r.clients[client.ClientID] = &cloned
	return nil
}

func (r *testClientRepo) Delete(id uint) error {
	for key, client := range r.clients {
		if client.ID == id {
			delete(r.clients, key)
			return nil
		}
	}
	return nil
}

func (r *testAuthHistoryRepo) Save(h *domain.AuthHistory) error {
	r.items = append(r.items, h)
	return nil
}

func (r *testAuthHistoryRepo) List(spec interface{}) ([]*domain.AuthHistory, int64, error) {
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
	uc := NewUserUsecase(repo, nil)

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
	authUC := NewAuthUsecase(userRepo, tokenRepo, newTestClientRepo(), nil, &testAuthHistoryRepo{}, jwtpkg.NewService("secret", time.Minute, time.Hour))

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
	uc := NewUserUsecase(userRepo, &testTokenRepo{})

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
	authUC := NewAuthUsecase(userRepo, tokenRepo, newTestClientRepo(), nil, authHistoryRepo, jwtpkg.NewService("secret", time.Minute, time.Hour))

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
	authUC := NewAuthUsecase(userRepo, &testTokenRepo{}, newTestClientRepo(), nil, &testAuthHistoryRepo{}, jwtpkg.NewService("secret", time.Minute, time.Hour))

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
	authUC := NewAuthUsecase(userRepo, &testTokenRepo{}, newTestClientRepo(), nil, &testAuthHistoryRepo{}, jwtpkg.NewService("secret", time.Minute, time.Hour))

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
	authUC := NewAuthUsecase(userRepo, &testTokenRepo{}, newTestClientRepo(), nil, &testAuthHistoryRepo{}, jwtpkg.NewService("secret", time.Minute, time.Hour))

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
	authUC := NewAuthUsecase(userRepo, &testTokenRepo{}, newTestClientRepo(), nil, &testAuthHistoryRepo{}, jwtpkg.NewService("secret", time.Minute, time.Hour))
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
	authUC := NewAuthUsecase(userRepo, &testTokenRepo{}, newTestClientRepo(), nil, &testAuthHistoryRepo{}, jwtpkg.NewService("secret", 15*time.Minute, time.Hour))

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

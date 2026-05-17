package usecase

import (
	"errors"
	"testing"
	"time"

	"github.com/owner/auth-server/internal/domain"
	jwtpkg "github.com/owner/auth-server/internal/jwt"
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
	saved         []*domain.RefreshToken
	revokedUserID uint
}

func (r *testTokenRepo) Save(t *domain.RefreshToken) error {
	r.saved = append(r.saved, t)
	return nil
}

func (r *testTokenRepo) FindByToken(token string) (*domain.RefreshToken, error) {
	return nil, errors.New("not implemented")
}

func (r *testTokenRepo) RevokeByUserID(userID uint) error {
	r.revokedUserID = userID
	return nil
}

func (r *testTokenRepo) RevokeToken(token string) error {
	return nil
}

type testAuthHistoryRepo struct{ items []*domain.AuthHistory }

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
	uc := NewUserUsecase(repo)

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
	if bcrypt.CompareHashAndPassword([]byte(saved.PasswordHistory[0]), []byte("TempPass@123")) != nil {
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
	authUC := NewAuthUsecase(userRepo, tokenRepo, nil, &testAuthHistoryRepo{}, jwtpkg.NewService("secret", time.Minute, time.Hour))

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
	uc := NewUserUsecase(userRepo)

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
	authUC := NewAuthUsecase(userRepo, tokenRepo, nil, authHistoryRepo, jwtpkg.NewService("secret", time.Minute, time.Hour))

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

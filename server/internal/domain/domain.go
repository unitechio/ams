package domain

import (
	"time"

	"github.com/owner/auth-server/internal/authorization/permission"
)

// ─── Domain Entities ──────────────────────────────────────────────────────────
// These are pure domain objects - no GORM tags, no framework dependencies

// User is the core authentication and authorization subject
type User struct {
	ID                uint
	Username          string
	PasswordHash      string
	PasswordHistory   []string
	AllowedClients    []string
	AllowedChannels   []string
	EmailVerified     bool
	EmailOTPHash      string
	EmailOTPExpiresAt *time.Time
	EmailVerifyHash   string
	EmailVerifyExpiry *time.Time
	TOTPSecret        string
	PendingTOTPSecret string
	Email             string
	FullName          string
	Phone             string
	Status            string // active | inactive | locked
	FailedLogins      int
	LockedUntil       *time.Time
	LastLogin         *time.Time
	CreatedAt         time.Time
	UpdatedAt         time.Time
	Deleted           bool
	PasswordExpiresAt *time.Time
	OneTimePassword   bool
	RequireOTP        bool
	TwoFactorEnabled  bool
	Roles             []*Role // loaded lazily
}

type AuthClient struct {
	ID                  uint
	ClientID            string
	ClientSecret        string
	Name                string
	Description         string
	AppType             string
	ClientTemplate      string
	Environment         string
	DomainGroup         string
	OwnerTeam           string
	Public              bool
	PKCERequired        bool
	Active              bool
	LegacyPasswordGrant bool
	ApprovalStatus      string
	GrantTypes          []string
	RedirectURIs        []string
	Audiences           []string
	Channels            []string
	TrustedTypes        []string
	Tags                []string
	SecretVersion       int
	SecretRotatedAt     *time.Time
	SecretExpiresAt     *time.Time
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

type SSOProvider struct {
	ID                 uint
	ProviderID         string
	Name               string
	Type               string
	ClientID           string
	ClientSecret       string
	AuthorizeURL       string
	TokenURL           string
	UserInfoURL        string
	RedirectURI        string
	Scope              string
	SAMLLoginURL       string
	Enabled            bool
	AllowAutoProvision bool
	Icon               string
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

type LoginChannel struct {
	ID                    uint
	Code                  string
	Name                  string
	Description           string
	RiskLevel             string
	RequireMFA            bool
	AllowPassword         bool
	AllowSSO              bool
	TrustedDeviceTTLHours int
	SessionTTLMinutes     int
	Active                bool
	CreatedAt             time.Time
	UpdatedAt             time.Time
}

type SecurityPolicy struct {
	ID            uint
	Code          string
	Name          string
	Description   string
	PolicyType    string
	ScopeType     string
	TargetClient  string
	TargetChannel string
	Priority      int
	Active        bool
	ConfigJSON    string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// EffectivePermissions resolves all permissions from user's roles
func (u *User) EffectivePermissions() *permission.PermissionSet {
	var eps []permission.EffectivePermission
	for _, role := range u.Roles {
		for _, rp := range role.Permissions {
			eps = append(eps, permission.EffectivePermission{
				Permission: rp.Code,
				Scope:      rp.Scope,
			})
		}
	}
	return permission.NewPermissionSet(eps)
}

// IsActive returns true if the user can authenticate
func (u *User) IsActive() bool {
	return u.Status == "active" && !u.Deleted
}

// IsLocked returns true if account is temporarily locked
func (u *User) IsLocked() bool {
	if u.Status == "locked" {
		return true
	}
	if u.LockedUntil != nil && u.LockedUntil.After(time.Now()) {
		return true
	}
	return false
}

// ─── Role ─────────────────────────────────────────────────────────────────────

// Role is a named grouping of permissions.
// IMPORTANT: role is NEVER used directly for feature authorization.
// It is only a convenience mechanism for grouping permissions.
type Role struct {
	ID          uint
	Name        string
	Description string
	CreatedAt   time.Time
	CreatedBy   string
	Deleted     bool
	Permissions []*RolePermission
}

// ─── RolePermission ───────────────────────────────────────────────────────────

// RolePermission maps a role to a permission with a specific scope.
// Scope controls DATA-LEVEL access (self / department / org / global).
type RolePermission struct {
	ID           uint
	RoleID       uint
	PermissionID uint
	Code         permission.Permission
	Scope        permission.Scope
}

// ─── Permission ───────────────────────────────────────────────────────────────

// PermissionDef defines a named permission with its code and metadata.
// This is the DB-persisted representation of permission constants.
type PermissionDef struct {
	ID          uint
	Code        permission.Permission // e.g. "user.read"
	Name        string                // Display name
	Description string
	GroupName   string // e.g. "user", "report"
	CreatedAt   time.Time
	Deleted     bool
}

// ─── Menu ─────────────────────────────────────────────────────────────────────

// Menu represents a navigation item in the system.
// Visibility is controlled by the linked PermissionCode.
type Menu struct {
	ID             uint
	Title          string
	URL            string
	SortOrder      int
	Icon           string
	PermissionCode permission.Permission // permission required to see this menu
	ParentID       *uint
	MenuType       string // main | sub | separator
	Deleted        bool
	Children       []*Menu // populated by tree builder
}

// PermissionLine represents a specific controller:action pair for a permission
type PermissionLine struct {
	ID           uint      `json:"id"`
	PermissionID uint      `json:"permission_id"`
	Controller   string    `json:"controller"`
	Action       string    `json:"action"`
	Note         string    `json:"note"`
	CreatedAt    time.Time `json:"created_at"`
	CreatedBy    string    `json:"created_by"`
	Deleted      bool      `json:"-"`
}

// ─── RefreshToken ─────────────────────────────────────────────────────────────

type RefreshToken struct {
	ID                uint
	UserID            uint
	Username          string
	UserEmail         string
	Token             string
	SessionID         string
	TokenFamily       string
	ClientID          string
	DeviceName        string
	DeviceFingerprint string
	IPAddress         string
	UserAgent         string
	Trusted           bool
	RotatedFrom       string
	RevokedReason     string
	ExpiresAt         time.Time
	LastUsedAt        time.Time
	ReuseDetectedAt   *time.Time
	Revoked           bool
	CreatedAt         time.Time
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

type AuditLog struct {
	ID         uint
	UserID     uint
	Username   string
	Action     string
	Resource   string
	ResourceID string
	IPAddress  string
	UserAgent  string
	Request    string // Chi tiết request (JSON hoặc mô tả)
	Response   string // Chi tiết kết quả trả về
	Allowed    bool
	CreatedAt  time.Time
}

type AuthHistory struct {
	ID        uint
	UserID    uint
	Username  string
	IPAddress string
	UserAgent string
	Status    string // success | failed | locked
	Note      string
	CreatedAt time.Time
}

// ─── Repository Interfaces ────────────────────────────────────────────────────

// UserRepository defines data access for User aggregate
type UserRepository interface {
	FindByID(id uint) (*User, error)
	FindByUsername(username string) (*User, error)
	FindByEmail(email string) (*User, error)
	List(spec interface{}) ([]*User, int64, error)
	Save(u *User) error
	Delete(id uint) error
	SetRoles(userID uint, roleIDs []uint) error
	UpdateLastLogin(userID uint) error
	UpdateFailedLogin(userID uint, count int, lockedUntil *time.Time) error
}

// RoleRepository defines data access for Role aggregate
type RoleRepository interface {
	FindByID(id uint) (*Role, error)
	List(spec interface{}) ([]*Role, int64, error)
	Save(r *Role) error
	Delete(id uint) error
	AssignPermissions(roleID uint, perms []RolePermission) error
	GetUserCount(roleID uint) int64
}

// PermissionRepository defines data access for permissions
type PermissionRepository interface {
	FindAll() ([]*PermissionDef, error)
	FindByCode(code permission.Permission) (*PermissionDef, error)
	FindByUserID(userID uint) ([]*RolePermission, error)
	Save(p *PermissionDef) error
	AddLine(line *PermissionLine) error
	DeleteLine(id uint) error
	GetLines(permissionID uint) ([]*PermissionLine, error)
}

// MenuRepository defines data access for menus
type MenuRepository interface {
	FindAll() ([]*Menu, error)
	FindByID(id uint) (*Menu, error)
	Save(m *Menu) error
	Delete(id uint) error
	ListPaginated(spec interface{}) ([]*Menu, int64, error)
}

// TokenRepository manages refresh tokens
type TokenRepository interface {
	Save(t *RefreshToken) error
	FindByToken(token string) (*RefreshToken, error)
	RevokeByUserID(userID uint) error
	RevokeToken(token string) error
	RevokeSession(userID uint, sessionID string) error
	RevokeSessionByID(sessionID string) error
	RevokeFamily(familyID string, reason string) error
	ListActiveSessions(userID uint) ([]*RefreshToken, error)
	ListSessions(filters map[string]interface{}) ([]*RefreshToken, int64, error)
	FindTrustedDevice(userID uint, clientID, fingerprint string) (*RefreshToken, error)
}

type ClientRepository interface {
	FindByClientID(clientID string) (*AuthClient, error)
	List(filters map[string]interface{}) ([]*AuthClient, int64, error)
	Save(client *AuthClient) error
	Delete(id uint) error
}

type SSOProviderRepository interface {
	FindByProviderID(providerID string) (*SSOProvider, error)
	List(filters map[string]interface{}) ([]*SSOProvider, int64, error)
	Save(provider *SSOProvider) error
	Delete(id uint) error
}

type LoginChannelRepository interface {
	FindByCode(code string) (*LoginChannel, error)
	List(filters map[string]interface{}) ([]*LoginChannel, int64, error)
	Save(channel *LoginChannel) error
	Delete(id uint) error
}

type SecurityPolicyRepository interface {
	List(filters map[string]interface{}) ([]*SecurityPolicy, int64, error)
	Save(policy *SecurityPolicy) error
	Delete(id uint) error
}

// AuditRepository for audit logging
type AuditLogRepository interface {
	Save(log *AuditLog) error
	List(spec interface{}) ([]*AuditLog, int64, error)
}

type AuthHistoryRepository interface {
	Save(h *AuthHistory) error
	List(spec interface{}) ([]*AuthHistory, int64, error)
}

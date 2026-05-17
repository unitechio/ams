package persistence

import "time"

// GORM models are the infrastructure representation of domain entities.
// They are ONLY used inside the persistence package — never exposed to upper layers.

type GormUser struct {
	ID                  uint   `gorm:"primaryKey;autoIncrement"`
	Username            string `gorm:"uniqueIndex;size:100;not null"`
	PasswordHash        string `gorm:"size:255;not null"`
	PasswordHistoryJSON string `gorm:"type:text;default:'[]'"`
	AllowedClientsJSON  string `gorm:"type:text;default:'[]'"`
	AllowedChannelsJSON string `gorm:"type:text;default:'[]'"`
	EmailVerified       bool   `gorm:"default:false"`
	EmailOTPHash        string `gorm:"size:255;default:''"`
	EmailOTPExpiresAt   *time.Time
	EmailVerifyHash     string `gorm:"size:255;default:''"`
	EmailVerifyExpiry   *time.Time
	TOTPSecret          string `gorm:"size:255;default:''"`
	PendingTOTPSecret   string `gorm:"size:255;default:''"`
	Email               string `gorm:"uniqueIndex;size:200"`
	FullName            string `gorm:"size:200;not null;default:''"`
	Phone               string `gorm:"size:20;default:''"`
	Status              string `gorm:"size:20;default:'active'"`
	FailedLogins        int    `gorm:"default:0"`
	LockedUntil         *time.Time
	LastLogin           *time.Time
	CreatedAt           time.Time
	UpdatedAt           time.Time
	Deleted             bool `gorm:"default:false"`
	PasswordExpiresAt   *time.Time
	OneTimePassword     bool `gorm:"default:false"`
	RequireOTP          bool `gorm:"default:false"`
	TwoFactorEnabled    bool `gorm:"default:false"`
}

func (GormUser) TableName() string { return "sys_users" }

type GormRole struct {
	ID          uint   `gorm:"primaryKey;autoIncrement"`
	Name        string `gorm:"uniqueIndex;size:100;not null"`
	Description string `gorm:"size:500;default:''"`
	CreatedAt   time.Time
	CreatedBy   string `gorm:"size:100;default:''"`
	Deleted     bool   `gorm:"default:false"`
}

func (GormRole) TableName() string { return "sys_roles" }

type GormUserRole struct {
	ID      uint `gorm:"primaryKey;autoIncrement"`
	UserID  uint `gorm:"not null;index"`
	RoleID  uint `gorm:"not null;index"`
	Deleted bool `gorm:"default:false"`
}

func (GormUserRole) TableName() string { return "sys_user_roles" }

type GormPermissionDef struct {
	ID          uint   `gorm:"primaryKey;autoIncrement"`
	Code        string `gorm:"uniqueIndex;size:200;not null"`
	Name        string `gorm:"size:200;not null"`
	Description string `gorm:"size:500;default:''"`
	GroupName   string `gorm:"size:100;not null;default:''"`
	CreatedAt   time.Time
	Deleted     bool `gorm:"default:false"`
}

func (GormPermissionDef) TableName() string { return "sys_permission_defs" }

type GormRolePermission struct {
	ID           uint   `gorm:"primaryKey;autoIncrement"`
	RoleID       uint   `gorm:"not null;index"`
	PermissionID uint   `gorm:"not null;index"`
	Scope        string `gorm:"size:50;not null;default:'self'"`
	Deleted      bool   `gorm:"default:false"`
}

func (GormRolePermission) TableName() string { return "sys_role_permissions" }

type GormPermissionLine struct {
	ID           uint   `gorm:"primaryKey;autoIncrement"`
	PermissionID uint   `gorm:"not null;index"`
	Controller   string `gorm:"size:200;not null"`
	Action       string `gorm:"size:200;not null"`
	Note         string `gorm:"size:500;default:''"`
	CreatedAt    time.Time
	CreatedBy    string `gorm:"size:100;default:''"`
	Deleted      bool   `gorm:"default:false"`
}

func (GormPermissionLine) TableName() string { return "sys_permission_lines" }

type GormMenu struct {
	ID             uint   `gorm:"primaryKey;autoIncrement"`
	Title          string `gorm:"size:200;not null"`
	URL            string `gorm:"size:500;default:'#'"`
	SortOrder      int    `gorm:"default:0"`
	Icon           string `gorm:"size:100;default:''"`
	PermissionCode string `gorm:"size:200;default:''"`
	ParentID       *uint
	MenuType       string `gorm:"size:50;not null;default:'main'"`
	Deleted        bool   `gorm:"default:false"`
}

func (GormMenu) TableName() string { return "sys_menus" }

type GormRefreshToken struct {
	ID                uint      `gorm:"primaryKey;autoIncrement"`
	UserID            uint      `gorm:"not null;index"`
	Token             string    `gorm:"uniqueIndex;size:512;not null"`
	SessionID         string    `gorm:"size:128;index"`
	TokenFamily       string    `gorm:"size:128;index"`
	ClientID          string    `gorm:"size:128;index"`
	DeviceName        string    `gorm:"size:255;default:''"`
	DeviceFingerprint string    `gorm:"size:255;index;default:''"`
	IPAddress         string    `gorm:"size:50;default:''"`
	UserAgent         string    `gorm:"size:500;default:''"`
	Trusted           bool      `gorm:"default:false"`
	RotatedFrom       string    `gorm:"size:512;default:''"`
	RevokedReason     string    `gorm:"size:255;default:''"`
	ExpiresAt         time.Time `gorm:"not null"`
	LastUsedAt        time.Time
	ReuseDetectedAt   *time.Time
	Revoked           bool `gorm:"default:false"`
	CreatedAt         time.Time
}

func (GormRefreshToken) TableName() string { return "sys_refresh_tokens" }

type GormAuthClient struct {
	ID               uint   `gorm:"primaryKey;autoIncrement"`
	ClientID         string `gorm:"uniqueIndex;size:150;not null"`
	ClientSecret     string `gorm:"size:255;default:''"`
	Name             string `gorm:"size:200;not null"`
	Description      string `gorm:"size:500;default:''"`
	AppType          string `gorm:"size:50;not null;default:'web_app'"`
	Public           bool   `gorm:"default:true"`
	PKCERequired     bool   `gorm:"default:false"`
	Active           bool   `gorm:"default:true"`
	GrantTypesJSON   string `gorm:"type:text;default:'[]'"`
	RedirectURIsJSON string `gorm:"type:text;default:'[]'"`
	AudiencesJSON    string `gorm:"type:text;default:'[]'"`
	ChannelsJSON     string `gorm:"type:text;default:'[]'"`
	TrustedTypesJSON string `gorm:"type:text;default:'[]'"`
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

func (GormAuthClient) TableName() string { return "sys_auth_clients" }

type GormSSOProvider struct {
	ID                 uint   `gorm:"primaryKey;autoIncrement"`
	ProviderID         string `gorm:"uniqueIndex;size:100;not null"`
	Name               string `gorm:"size:200;not null"`
	Type               string `gorm:"size:50;not null;default:'oidc'"`
	ClientID           string `gorm:"size:255;default:''"`
	ClientSecret       string `gorm:"size:255;default:''"`
	AuthorizeURL       string `gorm:"size:500;default:''"`
	TokenURL           string `gorm:"size:500;default:''"`
	UserInfoURL        string `gorm:"size:500;default:''"`
	RedirectURI        string `gorm:"size:500;default:''"`
	Scope              string `gorm:"size:500;default:''"`
	SAMLLoginURL       string `gorm:"size:500;default:''"`
	Enabled            bool   `gorm:"default:true"`
	AllowAutoProvision bool   `gorm:"default:true"`
	Icon               string `gorm:"size:100;default:''"`
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

func (GormSSOProvider) TableName() string { return "sys_sso_providers" }

type GormLoginChannel struct {
	ID                    uint   `gorm:"primaryKey;autoIncrement"`
	Code                  string `gorm:"uniqueIndex;size:100;not null"`
	Name                  string `gorm:"size:200;not null"`
	Description           string `gorm:"size:500;default:''"`
	RiskLevel             string `gorm:"size:50;default:'medium'"`
	RequireMFA            bool   `gorm:"default:false"`
	AllowPassword         bool   `gorm:"default:true"`
	AllowSSO              bool   `gorm:"default:true"`
	TrustedDeviceTTLHours int    `gorm:"default:720"`
	SessionTTLMinutes     int    `gorm:"default:1440"`
	Active                bool   `gorm:"default:true"`
	CreatedAt             time.Time
	UpdatedAt             time.Time
}

func (GormLoginChannel) TableName() string { return "sys_login_channels" }

type GormAuditLog struct {
	ID         uint   `gorm:"primaryKey;autoIncrement"`
	UserID     uint   `gorm:"index"`
	Username   string `gorm:"size:100;default:''"`
	Action     string `gorm:"size:200;not null"`
	Resource   string `gorm:"size:100;default:''"`
	ResourceID string `gorm:"size:100;default:''"`
	IPAddress  string `gorm:"size:50;default:''"`
	UserAgent  string `gorm:"size:500;default:''"`
	Request    string `gorm:"type:text"`
	Response   string `gorm:"type:text"`
	Allowed    bool   `gorm:"default:true"`
	CreatedAt  time.Time
}

func (GormAuditLog) TableName() string { return "sys_audit_logs" }

type GormAuthHistory struct {
	ID        uint      `gorm:"primaryKey;autoIncrement"`
	UserID    uint      `gorm:"index"`
	Username  string    `gorm:"size:100;default:''"`
	IPAddress string    `gorm:"size:50;default:''"`
	UserAgent string    `gorm:"size:500;default:''"`
	Status    string    `gorm:"size:50;default:''"` // success | failed | locked
	Note      string    `gorm:"size:500;default:''"`
	CreatedAt time.Time `gorm:"index"`
}

func (GormAuthHistory) TableName() string { return "sys_auth_histories" }

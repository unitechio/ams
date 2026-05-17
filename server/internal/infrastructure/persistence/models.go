package persistence

import "time"

// GORM models are the infrastructure representation of domain entities.
// They are ONLY used inside the persistence package — never exposed to upper layers.

type GormUser struct {
	ID                  uint   `gorm:"primaryKey;autoIncrement"`
	Username            string `gorm:"uniqueIndex;size:100;not null"`
	PasswordHash        string `gorm:"size:255;not null"`
	PasswordHistoryJSON string `gorm:"type:text;default:'[]'"`
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
	ID        uint      `gorm:"primaryKey;autoIncrement"`
	UserID    uint      `gorm:"not null;index"`
	Token     string    `gorm:"uniqueIndex;size:512;not null"`
	ExpiresAt time.Time `gorm:"not null"`
	Revoked   bool      `gorm:"default:false"`
	CreatedAt time.Time
}

func (GormRefreshToken) TableName() string { return "sys_refresh_tokens" }

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

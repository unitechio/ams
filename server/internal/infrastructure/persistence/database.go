package persistence

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/owner/auth-server/internal/authorization/permission"
	"github.com/owner/auth-server/internal/domain"
	passwordsvc "github.com/owner/auth-server/internal/security/password"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Connect opens the GORM database connection (PostgreSQL)
func Connect(dsn string) *gorm.DB {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("❌ failed to connect database: %v", err)
	}
	log.Println("✅ Connected to PostgreSQL")
	return db
}

// Migrate auto-migrates all GORM models
func Migrate(db *gorm.DB) {
	err := db.AutoMigrate(
		&GormUser{},
		&GormRole{},
		&GormUserRole{},
		&GormPermissionDef{},
		&GormRolePermission{},
		&GormPermissionLine{},
		&GormMenu{},
		&GormRefreshToken{},
		&GormAuthClient{},
		&GormAuditLog{},
		&GormAuthHistory{},
	)
	if err != nil {
		log.Fatalf("❌ failed to migrate: %v", err)
	}

	// ── PostgreSQL: Partial Unique Indexes for soft-delete support
	// Ensures username/email is unique ONLY among non-deleted records.
	db.Exec(`DROP INDEX IF EXISTS idx_sys_users_username`)
	db.Exec(`CREATE UNIQUE INDEX idx_sys_users_username ON sys_users (username) WHERE deleted = false`)

	db.Exec(`DROP INDEX IF EXISTS idx_sys_users_email`)
	db.Exec(`CREATE UNIQUE INDEX idx_sys_users_email ON sys_users (email) WHERE deleted = false`)

	ResetSequences(db)
	log.Println("✅ Database migrated with partial unique indexes and sequence resets")
}

// SyncMenus ensures all system menus exist in the DB with correct metadata.
func SyncMenus(db *gorm.DB) {
	u10 := uint(10)
	u20 := uint(20)
	u30 := uint(30)

	menus := []GormMenu{
		{ID: 1, Title: "Tổng quan", URL: "/", SortOrder: 9999, Icon: "LayoutDashboard", PermissionCode: ""},

		{ID: 10, Title: "Hệ thống", URL: "#", SortOrder: 1000, Icon: "Settings", PermissionCode: ""},
		{ID: 2, Title: "Người dùng", URL: "/users", SortOrder: 990, Icon: "Users", PermissionCode: string(permission.PermissionUserRead), ParentID: &u10},
		{ID: 7, Title: "Cấp vai trò", URL: "/user-roles", SortOrder: 980, Icon: "UserPlus", PermissionCode: string(permission.PermissionUserUpdate), ParentID: &u10},
		{ID: 3, Title: "Vai trò", URL: "/roles", SortOrder: 970, Icon: "Shield", PermissionCode: string(permission.PermissionRoleRead), ParentID: &u10},
		{ID: 8, Title: "Gán quyền Role", URL: "/roles/assign", SortOrder: 960, Icon: "ShieldCheck", PermissionCode: string(permission.PermissionRoleUpdate), ParentID: &u10},

		{ID: 20, Title: "Cấu hình", URL: "#", SortOrder: 800, Icon: "Wrench", PermissionCode: ""},
		{ID: 4, Title: "Menu Sidebar", URL: "/menus", SortOrder: 790, Icon: "Menu", PermissionCode: string(permission.PermissionMenuRead), ParentID: &u20},
		{ID: 5, Title: "Permission", URL: "/permissions", SortOrder: 780, Icon: "Key", PermissionCode: string(permission.PermissionPermRead), ParentID: &u20},
		{ID: 9, Title: "OAuth Clients", URL: "/auth-clients", SortOrder: 770, Icon: "AppWindow", PermissionCode: string(permission.PermissionClientRead), ParentID: &u20},
		{ID: 11, Title: "Service Accounts", URL: "/service-accounts", SortOrder: 760, Icon: "Bot", PermissionCode: string(permission.PermissionServiceRead), ParentID: &u20},

		{ID: 30, Title: "Nhật ký", URL: "#", SortOrder: 500, Icon: "FileText", PermissionCode: ""},
		{ID: 31, Title: "Lịch sử Login", URL: "/logs/auth", SortOrder: 490, Icon: "History", PermissionCode: string(permission.PermissionAuthRead), ParentID: &u30},
		{ID: 32, Title: "Audit Log", URL: "/logs/audit", SortOrder: 480, Icon: "Activity", PermissionCode: string(permission.PermissionAuditRead), ParentID: &u30},
		{ID: 33, Title: "Thiết bị", URL: "/devices", SortOrder: 470, Icon: "Smartphone", PermissionCode: string(permission.PermissionDeviceRead), ParentID: &u30},

		{ID: 6, Title: "Cài đặt", URL: "/settings", SortOrder: 100, Icon: "Settings", PermissionCode: string(permission.PermissionSettingRead)},
	}

	for _, m := range menus {
		db.Save(&m)
	}
	ResetSequences(db)
	log.Println("✅ System menus synchronized")
}

// Seed inserts initial data if the DB is empty
func Seed(db *gorm.DB, permRepo *GormPermissionRepository) {
	var count int64
	db.Model(&GormUser{}).Count(&count)
	if count > 0 {
		return
	}
	log.Println("🌱 Seeding database...")

	// ── Menus are now synced via SyncMenus on every start, but we call it here too for the first time
	SyncMenus(db)

	// ── Roles
	roles := []GormRole{
		{ID: 1, Name: "Super Admin", Description: "Toàn quyền hệ thống (*)", CreatedBy: "system"},
		{ID: 2, Name: "Admin", Description: "Quản trị viên toàn tổ chức", CreatedBy: "system"},
		{ID: 3, Name: "Manager", Description: "Quản lý phòng ban", CreatedBy: "system"},
		{ID: 4, Name: "Operator", Description: "Vận hành viên", CreatedBy: "system"},
		{ID: 5, Name: "Viewer", Description: "Chỉ xem dữ liệu của mình", CreatedBy: "system"},
	}
	db.CreateInBatches(roles, 10)

	// ── Super Admin gets wildcard permission
	var wildcardPerm GormPermissionDef
	if err := db.Where("code = ?", "*").First(&wildcardPerm).Error; err != nil {
		wildcardPerm = GormPermissionDef{Code: "*", Name: "Wildcard (Super Admin)", GroupName: "system"}
		db.Create(&wildcardPerm)
	}
	db.Create(&GormRolePermission{RoleID: 1, PermissionID: wildcardPerm.ID, Scope: string(permission.ScopeGlobal)})

	// ── Admin gets all non-wildcard perms with organization scope
	allPerms, _ := permRepo.FindAll()
	for _, p := range allPerms {
		if p.Code != permission.PermissionWildcard {
			db.Create(&GormRolePermission{RoleID: 2, PermissionID: p.ID, Scope: string(permission.ScopeOrganization)})
		}
	}

	// ── Manager: user.read/update, report.view at department scope
	var mgrPerms []GormPermissionDef
	db.Where("code IN ?", []string{
		string(permission.PermissionUserRead), string(permission.PermissionUserUpdate),
		string(permission.PermissionReportView), string(permission.PermissionAuditRead),
	}).Find(&mgrPerms)
	for _, p := range mgrPerms {
		db.Create(&GormRolePermission{RoleID: 3, PermissionID: p.ID, Scope: string(permission.ScopeDepartment)})
	}

	// ── Viewer: user.read, report.view at self scope
	var viewerPerms []GormPermissionDef
	db.Where("code IN ?", []string{
		string(permission.PermissionUserRead), string(permission.PermissionReportView),
	}).Find(&viewerPerms)
	for _, p := range viewerPerms {
		db.Create(&GormRolePermission{RoleID: 5, PermissionID: p.ID, Scope: string(permission.ScopeSelf)})
	}

	// ── Default users
	hashPw := func(pw string) string {
		h, _ := passwordsvc.Hash(pw)
		return string(h)
	}
	passwordHistoryJSON := func(hash string) string {
		payload, _ := json.Marshal([]string{hash})
		return string(payload)
	}
	now := time.Now()
	users := []struct {
		user   GormUser
		roleID uint
	}{
		{func() GormUser {
			hash := hashPw("Admin@123")
			return GormUser{Username: "superadmin", PasswordHash: hash, PasswordHistoryJSON: passwordHistoryJSON(hash), EmailVerified: true, Email: "superadmin@system.vn", FullName: "Super Administrator", Status: "active", LastLogin: &now}
		}(), 1},
		{func() GormUser {
			hash := hashPw("Admin@123")
			return GormUser{Username: "admin", PasswordHash: hash, PasswordHistoryJSON: passwordHistoryJSON(hash), AllowedClientsJSON: `["web_portal","crm_portal"]`, AllowedChannelsJSON: `["web","crm"]`, EmailVerified: true, Email: "admin@system.vn", FullName: "Administrator", Status: "active"}
		}(), 2},
		{func() GormUser {
			hash := hashPw("Admin@123")
			return GormUser{Username: "manager", PasswordHash: hash, PasswordHistoryJSON: passwordHistoryJSON(hash), AllowedClientsJSON: `["web_portal","crm_portal"]`, AllowedChannelsJSON: `["web","crm"]`, EmailVerified: true, Email: "manager@system.vn", FullName: "Nguyễn Văn Quản Lý", Status: "active"}
		}(), 3},
		{func() GormUser {
			hash := hashPw("Admin@123")
			return GormUser{Username: "operator", PasswordHash: hash, PasswordHistoryJSON: passwordHistoryJSON(hash), AllowedClientsJSON: `["web_portal"]`, AllowedChannelsJSON: `["web"]`, EmailVerified: true, Email: "operator@system.vn", FullName: "Trần Thị Vận Hành", Status: "active"}
		}(), 4},
		{func() GormUser {
			hash := hashPw("Admin@123")
			return GormUser{Username: "viewer", PasswordHash: hash, PasswordHistoryJSON: passwordHistoryJSON(hash), AllowedClientsJSON: `["mobile_app_tpv_public"]`, AllowedChannelsJSON: `["mobile"]`, EmailVerified: true, Email: "viewer@system.vn", FullName: "Lê Văn Chỉ Xem", Status: "active"}
		}(), 5},
	}
	for _, u := range users {
		db.Create(&u.user)
		db.Create(&GormUserRole{UserID: u.user.ID, RoleID: u.roleID})
	}

	clients := []GormAuthClient{
		{
			ClientID:         "web_portal",
			Name:             "Web Portal",
			Description:      "Public SPA for the admin web application",
			AppType:          "web_app",
			Public:           true,
			PKCERequired:     true,
			Active:           true,
			GrantTypesJSON:   `["password","refresh_token","authorization_code"]`,
			RedirectURIsJSON: `["https://app.company.com/callback"]`,
			AudiencesJSON:    `["web-api"]`,
			ChannelsJSON:     `["web"]`,
			TrustedTypesJSON: `["browser"]`,
		},
		{
			ClientID:         "crm_portal",
			ClientSecret:     "crm_portal_secret",
			Name:             "CRM Portal",
			Description:      "Confidential client for CRM backoffice",
			AppType:          "admin_portal",
			Public:           false,
			PKCERequired:     false,
			Active:           true,
			GrantTypesJSON:   `["password","refresh_token","authorization_code"]`,
			RedirectURIsJSON: `["https://crm.company.com/callback"]`,
			AudiencesJSON:    `["crm-api"]`,
			ChannelsJSON:     `["crm","web"]`,
			TrustedTypesJSON: `["browser","desktop"]`,
		},
		{
			ClientID:         "mobile_app_tpv_public",
			Name:             "Mobile App",
			Description:      "Public mobile application client with PKCE",
			AppType:          "mobile_app",
			Public:           true,
			PKCERequired:     true,
			Active:           true,
			GrantTypesJSON:   `["password","refresh_token","authorization_code"]`,
			RedirectURIsJSON: `["myapp://oauth/callback"]`,
			AudiencesJSON:    `["mobile-api"]`,
			ChannelsJSON:     `["mobile"]`,
			TrustedTypesJSON: `["mobile"]`,
		},
		{
			ClientID:         "payment_service",
			ClientSecret:     "payment_service_secret",
			Name:             "Payment Service",
			Description:      "Service account client for machine-to-machine payment jobs",
			AppType:          "internal_service",
			Public:           false,
			PKCERequired:     false,
			Active:           true,
			GrantTypesJSON:   `["client_credentials"]`,
			RedirectURIsJSON: `[]`,
			AudiencesJSON:    `["payment-api"]`,
			ChannelsJSON:     `["service"]`,
			TrustedTypesJSON: `["server"]`,
		},
	}
	db.CreateInBatches(clients, 20)

	log.Println("✅ Seed complete")
	log.Println("   👤 superadmin / Admin@123  →  Super Admin (*)")
	log.Println("   👤 admin      / Admin@123  →  Admin (org scope)")
	log.Println("   👤 manager    / Admin@123  →  Manager (dept scope)")
	log.Println("   👤 operator   / Admin@123  →  Operator")
	log.Println("   👤 viewer     / Admin@123  →  Viewer (self scope)")
}

// ResetSequences resets PostgreSQL SERIAL sequences to the max ID found in each table.
// This is necessary after seeding records with manual ID values.
func ResetSequences(db *gorm.DB) {
	tables := []string{"sys_users", "sys_roles", "sys_menus", "sys_permission_defs", "sys_role_permissions", "sys_user_roles", "sys_auth_clients", "sys_audit_logs", "sys_auth_histories"}
	for _, table := range tables {
		db.Exec(fmt.Sprintf("SELECT setval(pg_get_serial_sequence('%s', 'id'), COALESCE((SELECT MAX(id) FROM %s), 1))", table, table))
	}
	log.Println("✅ Primary key sequences reset")
}

// ─── Permission loader (implements middleware.PermissionLoader) ───────────────

type PermLoader struct{ db *gorm.DB }

func NewPermLoader(db *gorm.DB) *PermLoader { return &PermLoader{db} }

func (l *PermLoader) LoadForUser(userID uint) ([]*domain.RolePermission, error) {
	type row struct {
		Code  string
		Scope string
	}
	var rows []row
	err := l.db.Raw(`
		SELECT pd.code, rp.scope
		FROM sys_role_permissions rp
		JOIN sys_permission_defs pd ON pd.id = rp.permission_id AND pd.deleted = false
		JOIN sys_user_roles ur ON ur.role_id = rp.role_id AND ur.deleted = false
		WHERE ur.user_id = ? AND rp.deleted = false
	`, userID).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make([]*domain.RolePermission, len(rows))
	for i, r := range rows {
		result[i] = &domain.RolePermission{
			Code:  permission.Permission(r.Code),
			Scope: permission.Scope(r.Scope),
		}
	}
	return result, nil
}

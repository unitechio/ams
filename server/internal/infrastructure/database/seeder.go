package database

import (
	"context"
	"log"
	"time"

	"github.com/owner/auth-server/internal/authorization/permission"
	"github.com/owner/auth-server/internal/domain"
	passwordsvc "github.com/owner/auth-server/internal/security/password"
	"gorm.io/gorm"
)

// SyncMenus ensures all system menus exist in the DB with correct metadata.
func SyncMenus(db *gorm.DB) {
	u10 := uint(10)
	u20 := uint(20)
	u30 := uint(30)

	menus := []domain.Menu{
		{ID: 1, Title: "Tổng quan", URL: "/", SortOrder: 9999, Icon: "LayoutDashboard", PermissionCode: ""},

		{ID: 10, Title: "Hệ thống", URL: "#", SortOrder: 1000, Icon: "Settings", PermissionCode: ""},
		{ID: 2, Title: "Người dùng", URL: "/users", SortOrder: 990, Icon: "Users", PermissionCode: permission.PermissionUserRead, ParentID: &u10},
		{ID: 7, Title: "Cấp vai trò", URL: "/user-roles", SortOrder: 980, Icon: "UserPlus", PermissionCode: permission.PermissionUserUpdate, ParentID: &u10},
		{ID: 3, Title: "Vai trò", URL: "/roles", SortOrder: 970, Icon: "Shield", PermissionCode: permission.PermissionRoleRead, ParentID: &u10},
		{ID: 8, Title: "Gán quyền Role", URL: "/roles/assign", SortOrder: 960, Icon: "ShieldCheck", PermissionCode: permission.PermissionRoleUpdate, ParentID: &u10},

		{ID: 20, Title: "Cấu hình", URL: "#", SortOrder: 800, Icon: "Wrench", PermissionCode: ""},
		{ID: 4, Title: "Menu Sidebar", URL: "/menus", SortOrder: 790, Icon: "Menu", PermissionCode: permission.PermissionMenuRead, ParentID: &u20},
		{ID: 5, Title: "Permission", URL: "/permissions", SortOrder: 780, Icon: "Key", PermissionCode: permission.PermissionPermRead, ParentID: &u20},
		{ID: 9, Title: "OAuth Clients", URL: "/auth-clients", SortOrder: 770, Icon: "AppWindow", PermissionCode: permission.PermissionClientRead, ParentID: &u20},
		{ID: 12, Title: "SSO Providers", URL: "/sso-providers", SortOrder: 765, Icon: "Waypoints", PermissionCode: permission.PermissionClientRead, ParentID: &u20},
		{ID: 13, Title: "Login Channels", URL: "/login-channels", SortOrder: 762, Icon: "Workflow", PermissionCode: permission.Permission("channel.read"), ParentID: &u20},
		{ID: 14, Title: "Security Policies", URL: "/security-policies", SortOrder: 761, Icon: "ShieldAlert", PermissionCode: permission.Permission("policy.read"), ParentID: &u20},
		{ID: 15, Title: "Reference Options", URL: "/reference-options", SortOrder: 759, Icon: "ListTree", PermissionCode: permission.Permission("option.read"), ParentID: &u20},
		{ID: 16, Title: "Docs & Guides", URL: "/docs", SortOrder: 758, Icon: "BookOpen", PermissionCode: "", ParentID: &u20},
		{ID: 11, Title: "Service Accounts", URL: "/service-accounts", SortOrder: 760, Icon: "Bot", PermissionCode: permission.Permission("service.read"), ParentID: &u20},

		{ID: 30, Title: "Nhật ký", URL: "#", SortOrder: 500, Icon: "FileText", PermissionCode: ""},
		{ID: 31, Title: "Lịch sử Login", URL: "/logs/auth", SortOrder: 490, Icon: "History", PermissionCode: permission.PermissionAuthRead, ParentID: &u30},
		{ID: 32, Title: "Audit Log", URL: "/logs/audit", SortOrder: 480, Icon: "Activity", PermissionCode: permission.PermissionAuditRead, ParentID: &u30},
		{ID: 33, Title: "Thiết bị", URL: "/devices", SortOrder: 470, Icon: "Smartphone", PermissionCode: permission.PermissionDeviceRead, ParentID: &u30},

		{ID: 6, Title: "Cài đặt", URL: "/settings", SortOrder: 100, Icon: "Settings", PermissionCode: permission.PermissionSettingRead},
	}

	for _, m := range menus {
		db.Save(&m)
	}
	ResetSequences(db)
	log.Println("✅ System menus synchronized")
}

func SyncSecurityPolicies(db *gorm.DB) {
	policies := []domain.SecurityPolicy{
		{
			Code:        "global-auth-default",
			Name:        "Global Auth Default",
			Description: "Chính sách auth mặc định toàn hệ thống",
			PolicyType:  "auth",
			ScopeType:   "global",
			Priority:    10,
			Active:      true,
			ConfigJSON:  `{"session_ttl_minutes":1440,"refresh_ttl_minutes":10080,"trusted_device_ttl_hours":720,"step_up_ttl_minutes":10,"login_ip_max_attempts":20,"login_ip_window_minutes":5,"login_ip_block_minutes":15,"login_identity_max_attempts":7,"login_identity_window_minutes":10,"login_identity_block_minutes":30}`,
		},
		{
			Code:        "global-password-default",
			Name:        "Global Password Default",
			Description: "Password policy mặc định toàn hệ thống",
			PolicyType:  "password",
			ScopeType:   "global",
			Priority:    10,
			Active:      true,
			ConfigJSON:  `{"password_min_length":8,"require_upper":true,"require_lower":true,"require_number":true,"require_special":true}`,
		},
		{
			Code:         "step-up-client-rotate-secret",
			Name:         "Step-up Client Rotate Secret",
			Description:  "Bắt buộc step-up khi rotate client secret",
			PolicyType:   "step_up",
			ScopeType:    "global",
			TargetAction: "client.rotate_secret",
			Priority:     20,
			Active:       true,
			ConfigJSON:   `{"require_step_up":true}`,
		},
		{
			Code:         "step-up-policy-update",
			Name:         "Step-up Policy Update",
			Description:  "Bắt buộc step-up khi sửa security policy",
			PolicyType:   "step_up",
			ScopeType:    "global",
			TargetAction: "policy.update",
			Priority:     20,
			Active:       true,
			ConfigJSON:   `{"require_step_up":true}`,
		},
		{
			Code:         "step-up-device-revoke",
			Name:         "Step-up Device Revoke",
			Description:  "Bắt buộc step-up khi revoke thiết bị",
			PolicyType:   "step_up",
			ScopeType:    "global",
			TargetAction: "device.revoke",
			Priority:     20,
			Active:       true,
			ConfigJSON:   `{"require_step_up":true}`,
		},
		{
			Code:         "step-up-user-reset-password",
			Name:         "Step-up User Reset Password",
			Description:  "Bắt buộc step-up khi reset password người dùng",
			PolicyType:   "step_up",
			ScopeType:    "global",
			TargetAction: "user.reset_password",
			Priority:     20,
			Active:       true,
			ConfigJSON:   `{"require_step_up":true}`,
		},
		{
			Code:         "step-up-session-revoke",
			Name:         "Step-up Session Revoke",
			Description:  "Bắt buộc step-up khi thu hồi session hoặc logout các thiết bị khác",
			PolicyType:   "step_up",
			ScopeType:    "global",
			TargetAction: "session.revoke",
			Priority:     20,
			Active:       true,
			ConfigJSON:   `{"require_step_up":true}`,
		},
		{
			Code:         "step-up-disable-2fa",
			Name:         "Step-up Disable 2FA",
			Description:  "Bắt buộc step-up khi tắt xác thực hai lớp",
			PolicyType:   "step_up",
			ScopeType:    "global",
			TargetAction: "2fa.disable",
			Priority:     20,
			Active:       true,
			ConfigJSON:   `{"require_step_up":true}`,
		},
		{
			Code:         "step-up-role-assign-permissions",
			Name:         "Step-up Role Assign Permissions",
			Description:  "Bắt buộc step-up khi gán permission cho role",
			PolicyType:   "step_up",
			ScopeType:    "global",
			TargetAction: "role.assign_permissions",
			Priority:     20,
			Active:       true,
			ConfigJSON:   `{"require_step_up":true}`,
		},
		{
			Code:         "step-up-client-delete",
			Name:         "Step-up Client Delete",
			Description:  "Bắt buộc step-up khi xóa auth client hoặc service account",
			PolicyType:   "step_up",
			ScopeType:    "global",
			TargetAction: "client.delete",
			Priority:     20,
			Active:       true,
			ConfigJSON:   `{"require_step_up":true}`,
		},
		{
			Code:         "step-up-policy-delete",
			Name:         "Step-up Policy Delete",
			Description:  "Bắt buộc step-up khi xóa security policy",
			PolicyType:   "step_up",
			ScopeType:    "global",
			TargetAction: "policy.delete",
			Priority:     20,
			Active:       true,
			ConfigJSON:   `{"require_step_up":true}`,
		},
	}
	for _, item := range policies {
		var existing domain.SecurityPolicy
		if err := db.Where("code = ?", item.Code).First(&existing).Error; err != nil {
			db.Create(&item)
		}
	}
	log.Println("✅ Default security policies synchronized")
}

func SyncReferenceOptions(db *gorm.DB) {
	items := []domain.ReferenceOption{
		{OptionGroup: "client_template", Value: "spa_web", Label: "SPA Web", Description: "Public SPA dùng authorization_code + PKCE", SortOrder: 10, Active: true, MetaJSON: `{"app_type":"web_app","public":true,"channels":["web"],"grants":["authorization_code","refresh_token"],"trusted_types":["browser"],"pkce_required":true,"audiences":["web-api"],"tags":["portal","spa"]}`},
		{OptionGroup: "client_template", Value: "crm_portal", Label: "CRM Portal", Description: "Confidential client cho backoffice CRM", SortOrder: 20, Active: true, MetaJSON: `{"app_type":"admin_portal","public":false,"channels":["crm","web"],"grants":["authorization_code","refresh_token"],"trusted_types":["browser","desktop"],"pkce_required":false,"audiences":["crm-api"],"tags":["crm","backoffice"]}`},
		{OptionGroup: "client_template", Value: "mobile_pkce", Label: "Mobile PKCE", Description: "Public mobile app dùng PKCE", SortOrder: 30, Active: true, MetaJSON: `{"app_type":"mobile_app","public":true,"channels":["mobile"],"grants":["authorization_code","refresh_token"],"trusted_types":["mobile"],"pkce_required":true,"audiences":["mobile-api"],"tags":["mobile","public"]}`},
		{OptionGroup: "client_template", Value: "kiosk_public", Label: "Kiosk", Description: "Kiosk client với trust boundary thấp hơn", SortOrder: 40, Active: true, MetaJSON: `{"app_type":"kiosk","public":true,"channels":["kiosk"],"grants":["authorization_code","refresh_token"],"trusted_types":["device","browser"],"pkce_required":true,"audiences":["kiosk-api"],"tags":["kiosk","shared"]}`},
		{OptionGroup: "client_template", Value: "service_m2m", Label: "Internal Service", Description: "Service account dùng client_credentials", SortOrder: 50, Active: true, MetaJSON: `{"app_type":"internal_service","public":false,"channels":["service"],"grants":["client_credentials"],"trusted_types":["server"],"pkce_required":false,"audiences":["internal-api"],"tags":["service","internal"]}`},
		{OptionGroup: "client_template", Value: "partner_oidc", Label: "Partner Portal", Description: "Portal/integration cho đối tác", SortOrder: 60, Active: true, MetaJSON: `{"app_type":"partner_api","public":false,"channels":["partner"],"grants":["authorization_code","refresh_token"],"trusted_types":["browser","server"],"pkce_required":false,"audiences":["partner-api"],"tags":["partner","external"]}`},
		{OptionGroup: "client_template", Value: "custom", Label: "Custom", Description: "Template tự do cho trường hợp mở rộng", SortOrder: 70, Active: true, MetaJSON: `{"app_type":"web_app","public":true,"channels":["web"],"grants":["authorization_code","refresh_token"],"trusted_types":["browser"],"pkce_required":true,"audiences":["default-api"],"tags":["custom"]}`},

		{OptionGroup: "client_environment", Value: "dev", Label: "Development", SortOrder: 10, Active: true},
		{OptionGroup: "client_environment", Value: "stg", Label: "Staging", SortOrder: 20, Active: true},
		{OptionGroup: "client_environment", Value: "prod", Label: "Production", SortOrder: 30, Active: true},

		{OptionGroup: "client_app_type", Value: "web_app", Label: "Web App", SortOrder: 10, Active: true},
		{OptionGroup: "client_app_type", Value: "mobile_app", Label: "Mobile App", SortOrder: 20, Active: true},
		{OptionGroup: "client_app_type", Value: "admin_portal", Label: "Admin Portal", SortOrder: 30, Active: true},
		{OptionGroup: "client_app_type", Value: "kiosk", Label: "Kiosk", SortOrder: 40, Active: true},
		{OptionGroup: "client_app_type", Value: "internal_service", Label: "Internal Service", SortOrder: 50, Active: true},
		{OptionGroup: "client_app_type", Value: "partner_api", Label: "Partner API", SortOrder: 60, Active: true},

		{OptionGroup: "client_approval_status", Value: "approved", Label: "Approved", SortOrder: 10, Active: true},
		{OptionGroup: "client_approval_status", Value: "pending", Label: "Pending Approval", SortOrder: 20, Active: true},
		{OptionGroup: "client_approval_status", Value: "rejected", Label: "Rejected", SortOrder: 30, Active: true},

		{OptionGroup: "policy_type", Value: "auth", Label: "Auth", SortOrder: 10, Active: true},
		{OptionGroup: "policy_type", Value: "password", Label: "Password", SortOrder: 20, Active: true},
		{OptionGroup: "policy_type", Value: "step_up", Label: "Step-up Action", SortOrder: 30, Active: true},

		{OptionGroup: "policy_scope_type", Value: "global", Label: "Global", SortOrder: 10, Active: true},
		{OptionGroup: "policy_scope_type", Value: "client", Label: "Client", SortOrder: 20, Active: true},
		{OptionGroup: "policy_scope_type", Value: "channel", Label: "Channel", SortOrder: 30, Active: true},
		{OptionGroup: "policy_scope_type", Value: "client_channel", Label: "Client + Channel", SortOrder: 40, Active: true},

		{OptionGroup: "step_up_action", Value: "client.rotate_secret", Label: "client.rotate_secret", SortOrder: 10, Active: true},
		{OptionGroup: "step_up_action", Value: "policy.update", Label: "policy.update", SortOrder: 20, Active: true},
		{OptionGroup: "step_up_action", Value: "device.revoke", Label: "device.revoke", SortOrder: 30, Active: true},
		{OptionGroup: "step_up_action", Value: "user.reset_password", Label: "user.reset_password", SortOrder: 40, Active: true},
		{OptionGroup: "step_up_action", Value: "session.revoke", Label: "session.revoke", SortOrder: 50, Active: true},
		{OptionGroup: "step_up_action", Value: "2fa.disable", Label: "2fa.disable", SortOrder: 60, Active: true},
		{OptionGroup: "step_up_action", Value: "role.assign_permissions", Label: "role.assign_permissions", SortOrder: 70, Active: true},
		{OptionGroup: "step_up_action", Value: "client.delete", Label: "client.delete", SortOrder: 80, Active: true},
		{OptionGroup: "step_up_action", Value: "policy.delete", Label: "policy.delete", SortOrder: 90, Active: true},

		{OptionGroup: "channel_risk_level", Value: "low", Label: "Low", SortOrder: 10, Active: true},
		{OptionGroup: "channel_risk_level", Value: "medium", Label: "Medium", SortOrder: 20, Active: true},
		{OptionGroup: "channel_risk_level", Value: "high", Label: "High", SortOrder: 30, Active: true},
	}
	for _, item := range items {
		var existing domain.ReferenceOption
		if err := db.Where("option_group = ? AND value = ?", item.OptionGroup, item.Value).First(&existing).Error; err != nil {
			db.Create(&item)
		}
	}
	log.Println("✅ Default reference options synchronized")
}

func SyncAuthClients(db *gorm.DB) {
	clients := []domain.AuthClient{
		{
			ClientID:            "web_portal",
			Name:                "Web Portal",
			Description:         "Public SPA for the admin web application",
			AppType:             "web_app",
			ClientTemplate:      "spa_web",
			Environment:         "prod",
			DomainGroup:         "admin",
			OwnerTeam:           "identity",
			Public:              true,
			PKCERequired:        true,
			Active:              true,
			LegacyPasswordGrant: true,
			ApprovalStatus:      "approved",
			GrantTypes:          []string{"password", "refresh_token", "authorization_code"},
			RedirectURIs:        []string{"https://app.company.com/callback"},
			Audiences:           []string{"web-api"},
			Channels:            []string{"web"},
			TrustedTypes:        []string{"browser"},
			Tags:                []string{"portal", "spa"},
			SecretVersion:       1,
		},
		{
			ClientID:            "crm_portal",
			ClientSecret:        "crm_portal_secret",
			Name:                "CRM Portal",
			Description:         "Confidential client for CRM backoffice",
			AppType:             "admin_portal",
			ClientTemplate:      "crm_portal",
			Environment:         "prod",
			DomainGroup:         "crm",
			OwnerTeam:           "crm",
			Public:              false,
			PKCERequired:        false,
			Active:              true,
			LegacyPasswordGrant: true,
			ApprovalStatus:      "approved",
			GrantTypes:          []string{"password", "refresh_token", "authorization_code"},
			RedirectURIs:        []string{"https://crm.company.com/callback"},
			Audiences:           []string{"crm-api"},
			Channels:            []string{"crm", "web"},
			TrustedTypes:        []string{"browser", "desktop"},
			Tags:                []string{"crm", "backoffice"},
			SecretVersion:       1,
		},
		{
			ClientID:            "mobile_app_tpv_public",
			Name:                "Mobile App",
			Description:         "Public mobile application client with PKCE",
			AppType:             "mobile_app",
			ClientTemplate:      "mobile_pkce",
			Environment:         "prod",
			DomainGroup:         "mobile",
			OwnerTeam:           "mobile",
			Public:              true,
			PKCERequired:        true,
			Active:              true,
			LegacyPasswordGrant: true,
			ApprovalStatus:      "approved",
			GrantTypes:          []string{"password", "refresh_token", "authorization_code"},
			RedirectURIs:        []string{"myapp://oauth/callback"},
			Audiences:           []string{"mobile-api"},
			Channels:            []string{"mobile"},
			TrustedTypes:        []string{"mobile"},
			Tags:                []string{"mobile", "public"},
			SecretVersion:       1,
		},
		{
			ClientID:            "payment_service",
			ClientSecret:        "payment_service_secret",
			Name:                "Payment Service",
			Description:         "Service account client for machine-to-machine payment jobs",
			AppType:             "internal_service",
			ClientTemplate:      "service_m2m",
			Environment:         "prod",
			DomainGroup:         "payments",
			OwnerTeam:           "platform",
			Public:              false,
			PKCERequired:        false,
			Active:              true,
			LegacyPasswordGrant: false,
			ApprovalStatus:      "approved",
			GrantTypes:          []string{"client_credentials"},
			RedirectURIs:        []string{},
			Audiences:           []string{"payment-api"},
			Channels:            []string{"service"},
			TrustedTypes:        []string{"server"},
			Tags:                []string{"service", "payments"},
			SecretVersion:       1,
		},
	}
	for _, item := range clients {
		var existing domain.AuthClient
		if err := db.Where("client_id = ?", item.ClientID).First(&existing).Error; err != nil {
			db.Create(&item)
		}
	}
	log.Println("✅ Default auth clients synchronized")
}

func SyncLoginChannels(db *gorm.DB) {
	channels := []domain.LoginChannel{
		{Code: "web", Name: "Web Portal", Description: "Browser-based user login", RiskLevel: "medium", RequireMFA: false, AllowPassword: true, AllowSSO: true, TrustedDeviceTTLHours: 720, SessionTTLMinutes: 1440, Active: true},
		{Code: "crm", Name: "CRM Portal", Description: "Backoffice CRM login", RiskLevel: "high", RequireMFA: true, AllowPassword: true, AllowSSO: true, TrustedDeviceTTLHours: 336, SessionTTLMinutes: 720, Active: true},
		{Code: "mobile", Name: "Mobile App", Description: "Native mobile application login", RiskLevel: "medium", RequireMFA: false, AllowPassword: true, AllowSSO: true, TrustedDeviceTTLHours: 1440, SessionTTLMinutes: 43200, Active: true},
		{Code: "service", Name: "Internal API / Service", Description: "Machine-to-machine integration", RiskLevel: "high", RequireMFA: false, AllowPassword: false, AllowSSO: false, TrustedDeviceTTLHours: 0, SessionTTLMinutes: 60, Active: true},
		{Code: "kiosk", Name: "Kiosk", Description: "Public or semi-trusted kiosk devices", RiskLevel: "high", RequireMFA: true, AllowPassword: true, AllowSSO: false, TrustedDeviceTTLHours: 24, SessionTTLMinutes: 120, Active: true},
		{Code: "partner", Name: "Partner Portal", Description: "External partner access", RiskLevel: "high", RequireMFA: true, AllowPassword: true, AllowSSO: true, TrustedDeviceTTLHours: 168, SessionTTLMinutes: 480, Active: true},
	}
	for _, item := range channels {
		var existing domain.LoginChannel
		if err := db.Where("code = ?", item.Code).First(&existing).Error; err != nil {
			db.Create(&item)
		}
	}
	log.Println("✅ Default login channels synchronized")
}

// Seed inserts initial data if the DB is empty
func Seed(db *gorm.DB, permRepo domain.PermissionRepository) {
	var count int64
	db.Model(&domain.User{}).Count(&count)
	if count > 0 {
		return
	}
	log.Println("🌱 Seeding database...")

	// ── Menus are now synced via SyncMenus on every start, but we call it here too for the first time
	SyncMenus(db)

	// ── Roles
	roles := []domain.Role{
		{ID: 1, Name: "Super Admin", Description: "Toàn quyền hệ thống (*)"},
		{ID: 2, Name: "Admin", Description: "Quản trị viên toàn tổ chức"},
		{ID: 3, Name: "Manager", Description: "Quản lý phòng ban"},
		{ID: 4, Name: "Operator", Description: "Vận hành viên"},
		{ID: 5, Name: "Viewer", Description: "Chỉ xem dữ liệu của mình"},
	}
	db.CreateInBatches(roles, 10)

	// ── Super Admin gets wildcard permission
	var wildcardPerm domain.PermissionDef
	if err := db.Where("code = ?", "*").First(&wildcardPerm).Error; err != nil {
		wildcardPerm = domain.PermissionDef{Code: "*", Name: "Wildcard (Super Admin)", GroupName: "system"}
		db.Create(&wildcardPerm)
	}
	db.Exec("INSERT INTO sys_role_permissions (role_id, permission_id, scope) VALUES (?, ?, ?)", 1, wildcardPerm.ID, string(permission.ScopeGlobal))

	// ── Admin gets all non-wildcard perms with organization scope
	allPerms, _ := permRepo.FindAll(context.Background())
	for _, p := range allPerms {
		if p.Code != permission.PermissionWildcard {
			db.Exec("INSERT INTO sys_role_permissions (role_id, permission_id, scope) VALUES (?, ?, ?)", 2, p.ID, string(permission.ScopeOrganization))
		}
	}

	// ── Default users
	hashPw := func(pw string) string {
		h, _ := passwordsvc.Hash(pw)
		return string(h)
	}
	now := time.Now()
	users := []struct {
		user   domain.User
		roleID uint
	}{
		{func() domain.User {
			hash := hashPw("Admin@123")
			return domain.User{Username: "superadmin", PasswordHash: hash, PasswordHistory: []string{hash}, EmailVerified: true, Email: "superadmin@system.vn", FullName: "Super Administrator", Status: "active", LastLogin: &now}
		}(), 1},
		{func() domain.User {
			hash := hashPw("Admin@123")
			return domain.User{Username: "admin", PasswordHash: hash, PasswordHistory: []string{hash}, AllowedClients: []string{"web_portal", "crm_portal"}, AllowedChannels: []string{"web", "crm"}, EmailVerified: true, Email: "admin@system.vn", FullName: "Administrator", Status: "active"}
		}(), 2},
		{func() domain.User {
			hash := hashPw("Admin@123")
			return domain.User{Username: "manager", PasswordHash: hash, PasswordHistory: []string{hash}, AllowedClients: []string{"web_portal", "crm_portal"}, AllowedChannels: []string{"web", "crm"}, EmailVerified: true, Email: "manager@system.vn", FullName: "Nguyễn Văn Quản Lý", Status: "active"}
		}(), 3},
		{func() domain.User {
			hash := hashPw("Admin@123")
			return domain.User{Username: "operator", PasswordHash: hash, PasswordHistory: []string{hash}, AllowedClients: []string{"web_portal"}, AllowedChannels: []string{"web"}, EmailVerified: true, Email: "operator@system.vn", FullName: "Trần Thị Vận Hành", Status: "active"}
		}(), 4},
		{func() domain.User {
			hash := hashPw("Admin@123")
			return domain.User{Username: "viewer", PasswordHash: hash, PasswordHistory: []string{hash}, AllowedClients: []string{"mobile_app_tpv_public"}, AllowedChannels: []string{"mobile"}, EmailVerified: true, Email: "viewer@system.vn", FullName: "Lê Văn Chỉ Xem", Status: "active"}
		}(), 5},
	}
	for _, u := range users {
		db.Create(&u.user)
		db.Exec("INSERT INTO sys_user_roles (user_id, role_id) VALUES (?, ?)", u.user.ID, u.roleID)
	}

	providers := []domain.SSOProvider{
		{
			ProviderID:         "google",
			Name:               "Google Workspace",
			Type:               "oidc",
			ClientID:           "google-client-id",
			ClientSecret:       "google-client-secret",
			AuthorizeURL:       "https://accounts.google.com/o/oauth2/v2/auth",
			TokenURL:           "https://oauth2.googleapis.com/token",
			UserInfoURL:        "https://openidconnect.googleapis.com/v1/userinfo",
			RedirectURI:        "http://localhost:5173/sso/callback/google",
			Scope:              "openid profile email",
			Enabled:            false,
			AllowAutoProvision: true,
			Icon:               "Chrome",
		},
		{
			ProviderID:         "microsoft",
			Name:               "Microsoft Entra ID",
			Type:               "oidc",
			ClientID:           "microsoft-client-id",
			ClientSecret:       "microsoft-client-secret",
			AuthorizeURL:       "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
			TokenURL:           "https://login.microsoftonline.com/common/oauth2/v2.0/token",
			UserInfoURL:        "https://graph.microsoft.com/oidc/userinfo",
			RedirectURI:        "http://localhost:5173/sso/callback/microsoft",
			Scope:              "openid profile email",
			Enabled:            false,
			AllowAutoProvision: true,
			Icon:               "BadgeCheck",
		},
		{
			ProviderID:         "enterprise",
			Name:               "Enterprise SAML",
			Type:               "saml",
			RedirectURI:        "http://localhost:5173/sso/callback/enterprise",
			SAMLLoginURL:       "https://idp.company.com/saml/login",
			Enabled:            false,
			AllowAutoProvision: false,
			Icon:               "Building2",
		},
	}
	db.CreateInBatches(providers, 10)

	log.Println("✅ Seed complete")
	log.Println("   👤 superadmin / Admin@123  →  Super Admin (*)")
	log.Println("   👤 admin      / Admin@123  →  Admin (org scope)")
	log.Println("   👤 manager    / Admin@123  →  Manager (dept scope)")
	log.Println("   👤 operator   / Admin@123  →  Operator")
	log.Println("   👤 viewer     / Admin@123  →  Viewer (self scope)")
}

// ResetSequences resets PostgreSQL SERIAL sequences to the max ID found in each table.
// This is necessary after seeding records with manual ID values.
// func ResetSequences(db *gorm.DB) {
// 	tables := []string{"sys_users", "sys_roles", "sys_menus", "sys_permission_defs", "sys_role_permissions", "sys_user_roles", "sys_auth_clients", "sys_sso_providers", "sys_login_channels", "sys_security_policies", "sys_audit_logs", "sys_auth_histories"}
// 	for _, table := range tables {
// 		db.Exec(fmt.Sprintf("SELECT setval(pg_get_serial_sequence('%s', 'id'), COALESCE((SELECT MAX(id) FROM %s), 1))", table, table))
// 	}
// 	log.Println("✅ Primary key sequences reset")
// }

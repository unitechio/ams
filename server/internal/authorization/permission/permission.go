package permission

// Permission là kiểu định danh quyền, tránh dùng string thô
type Permission string

// Scope định nghĩa phạm vi dữ liệu được phép truy cập
type Scope string

// ─── Scope Constants ──────────────────────────────────────────────────────────
const (
	ScopeSelf         Scope = "self"         // chỉ dữ liệu của bản thân
	ScopeDepartment   Scope = "department"   // toàn bộ phòng ban
	ScopeOrganization Scope = "organization" // toàn bộ tổ chức
	ScopeGlobal       Scope = "global"       // không giới hạn
)

// ScopeLevel trả về số thứ tự ưu tiên của scope (cao hơn = rộng hơn)
func (s Scope) Level() int {
	switch s {
	case ScopeSelf:
		return 1
	case ScopeDepartment:
		return 2
	case ScopeOrganization:
		return 3
	case ScopeGlobal:
		return 4
	default:
		return 0
	}
}

// IsAtLeast kiểm tra scope có >= scope yêu cầu không
func (s Scope) IsAtLeast(required Scope) bool {
	return s.Level() >= required.Level()
}

// ─── Permission Constants (centralized registry) ──────────────────────────────
const (
	// Wildcard - bypass all checks (Super Admin)
	PermissionWildcard Permission = "*"

	// ── User Management
	PermissionUserRead   Permission = "user.read"
	PermissionUserCreate Permission = "user.create"
	PermissionUserUpdate Permission = "user.update"
	PermissionUserDelete Permission = "user.delete"
	PermissionUserExport Permission = "user.export"

	// ── Role Management
	PermissionRoleRead   Permission = "role.read"
	PermissionRoleCreate Permission = "role.create"
	PermissionRoleUpdate Permission = "role.update"
	PermissionRoleDelete Permission = "role.delete"
	PermissionRoleAssign Permission = "role.assign"

	// ── Permission Management
	PermissionPermRead   Permission = "permission.read"
	PermissionPermCreate Permission = "permission.create"
	PermissionPermUpdate Permission = "permission.update"
	PermissionPermDelete Permission = "permission.delete"
	PermissionPermAssign Permission = "permission.assign"

	// ── Menu Management
	PermissionMenuRead   Permission = "menu.read"
	PermissionMenuCreate Permission = "menu.create"
	PermissionMenuUpdate Permission = "menu.update"
	PermissionMenuDelete Permission = "menu.delete"

	// ── Reports
	PermissionReportView   Permission = "report.view"
	PermissionReportExport Permission = "report.export"

	// ── Settings
	PermissionSettingRead   Permission = "setting.read"
	PermissionSettingUpdate Permission = "setting.update"

	// ── Audit
	PermissionAuditRead Permission = "audit.read"
	PermissionAuthRead  Permission = "auth.read"

	// ── Device Management
	PermissionDeviceRead   Permission = "device.read"
	PermissionDeviceRevoke Permission = "device.revoke"

	// ── OAuth Client Management
	PermissionClientRead   Permission = "client.read"
	PermissionClientCreate Permission = "client.create"
	PermissionClientUpdate Permission = "client.update"
	PermissionClientDelete Permission = "client.delete"

	// ── Service Account Management
	PermissionServiceRead   Permission = "service.read"
	PermissionServiceCreate Permission = "service.create"
	PermissionServiceUpdate Permission = "service.update"
	PermissionServiceDelete Permission = "service.delete"

	// ── Login Channel Management
	PermissionChannelRead   Permission = "channel.read"
	PermissionChannelCreate Permission = "channel.create"
	PermissionChannelUpdate Permission = "channel.update"
	PermissionChannelDelete Permission = "channel.delete"

	// ── Security Policy Management
	PermissionPolicyRead   Permission = "policy.read"
	PermissionPolicyCreate Permission = "policy.create"
	PermissionPolicyUpdate Permission = "policy.update"
	PermissionPolicyDelete Permission = "policy.delete"

	// ── Reference Option Management
	PermissionOptionRead   Permission = "option.read"
	PermissionOptionCreate Permission = "option.create"
	PermissionOptionUpdate Permission = "option.update"
	PermissionOptionDelete Permission = "option.delete"
)

// ─── Permission Group Registry ────────────────────────────────────────────────
type PermissionGroup struct {
	Name        string
	Description string
	Permissions []Permission
}

var Registry = []PermissionGroup{
	{
		Name:        "user",
		Description: "Quản lý người dùng",
		Permissions: []Permission{PermissionUserRead, PermissionUserCreate, PermissionUserUpdate, PermissionUserDelete, PermissionUserExport},
	},
	{
		Name:        "role",
		Description: "Quản lý vai trò",
		Permissions: []Permission{PermissionRoleRead, PermissionRoleCreate, PermissionRoleUpdate, PermissionRoleDelete, PermissionRoleAssign},
	},
	{
		Name:        "permission",
		Description: "Quản lý quyền hạn",
		Permissions: []Permission{PermissionPermRead, PermissionPermCreate, PermissionPermUpdate, PermissionPermDelete, PermissionPermAssign},
	},
	{
		Name:        "menu",
		Description: "Quản lý menu",
		Permissions: []Permission{PermissionMenuRead, PermissionMenuCreate, PermissionMenuUpdate, PermissionMenuDelete},
	},
	{
		Name:        "report",
		Description: "Báo cáo",
		Permissions: []Permission{PermissionReportView, PermissionReportExport},
	},
	{
		Name:        "setting",
		Description: "Cài đặt hệ thống",
		Permissions: []Permission{PermissionSettingRead, PermissionSettingUpdate},
	},
	{
		Name:        "audit",
		Description: "Nhật ký hệ thống",
		Permissions: []Permission{PermissionAuditRead, PermissionAuthRead},
	},
	{
		Name:        "device",
		Description: "Quản lý thiết bị và phiên đăng nhập",
		Permissions: []Permission{PermissionDeviceRead, PermissionDeviceRevoke},
	},
	{
		Name:        "client",
		Description: "Quản lý OAuth clients và redirect policy",
		Permissions: []Permission{PermissionClientRead, PermissionClientCreate, PermissionClientUpdate, PermissionClientDelete},
	},
	{
		Name:        "service",
		Description: "Quản lý service account và machine-to-machine clients",
		Permissions: []Permission{PermissionServiceRead, PermissionServiceCreate, PermissionServiceUpdate, PermissionServiceDelete},
	},
	{
		Name:        "channel",
		Description: "Quản lý login channel, risk level và channel policy",
		Permissions: []Permission{PermissionChannelRead, PermissionChannelCreate, PermissionChannelUpdate, PermissionChannelDelete},
	},
	{
		Name:        "policy",
		Description: "Quản lý auth/security policy theo global, client và channel",
		Permissions: []Permission{PermissionPolicyRead, PermissionPolicyCreate, PermissionPolicyUpdate, PermissionPolicyDelete},
	},
	{
		Name:        "option",
		Description: "Quản lý reference option cho dropdown, template và catalog runtime",
		Permissions: []Permission{PermissionOptionRead, PermissionOptionCreate, PermissionOptionUpdate, PermissionOptionDelete},
	},
}

// AllPermissions trả về tất cả permission codes trong registry
func AllPermissions() []Permission {
	var all []Permission
	for _, g := range Registry {
		all = append(all, g.Permissions...)
	}
	return all
}

// IsValid kiểm tra permission có tồn tại trong registry không
func IsValid(p Permission) bool {
	if p == PermissionWildcard {
		return true
	}
	for _, g := range Registry {
		for _, perm := range g.Permissions {
			if perm == p {
				return true
			}
		}
	}
	return false
}

// ─── Effective Permission (permission + scope pair) ───────────────────────────
type EffectivePermission struct {
	Permission Permission
	Scope      Scope
}

// PermissionSet là tập hợp các effective permission của một user
type PermissionSet struct {
	permissions map[Permission]Scope
	isWildcard  bool
}

func NewPermissionSet(perms []EffectivePermission) *PermissionSet {
	ps := &PermissionSet{permissions: make(map[Permission]Scope)}
	for _, ep := range perms {
		if ep.Permission == PermissionWildcard {
			ps.isWildcard = true
			return ps
		}
		// Keep the broadest scope if same permission appears multiple times
		if existing, ok := ps.permissions[ep.Permission]; !ok || ep.Scope.IsAtLeast(existing) {
			ps.permissions[ep.Permission] = ep.Scope
		}
	}
	return ps
}

// Has kiểm tra có quyền không (bất kể scope)
func (ps *PermissionSet) Has(p Permission) bool {
	if ps.isWildcard {
		return true
	}
	_, ok := ps.permissions[p]
	return ok
}

// HasWithScope kiểm tra có quyền với đủ scope không
func (ps *PermissionSet) HasWithScope(p Permission, required Scope) bool {
	if ps.isWildcard {
		return true
	}
	scope, ok := ps.permissions[p]
	if !ok {
		return false
	}
	return scope.IsAtLeast(required)
}

// GetScope trả về scope của một permission
func (ps *PermissionSet) GetScope(p Permission) (Scope, bool) {
	if ps.isWildcard {
		return ScopeGlobal, true
	}
	scope, ok := ps.permissions[p]
	return scope, ok
}

// IsSuperAdmin kiểm tra có wildcard không
func (ps *PermissionSet) IsSuperAdmin() bool {
	return ps.isWildcard
}

// List trả về tất cả permission hiệu lực dưới dạng chuỗi "perm:scope"
func (ps *PermissionSet) List() []string {
	if ps.isWildcard {
		return []string{"*"}
	}
	result := make([]string, 0, len(ps.permissions))
	for p, s := range ps.permissions {
		result = append(result, string(p)+":"+string(s))
	}
	return result
}

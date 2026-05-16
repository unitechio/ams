package persistence

import (
	"fmt"
	"time"

	"github.com/owner/auth-server/internal/authorization/permission"
	"github.com/owner/auth-server/internal/authorization/specification"
	"github.com/owner/auth-server/internal/domain"
	"gorm.io/gorm"
)

// ─── User Repository ──────────────────────────────────────────────────────────

type GormUserRepository struct{ db *gorm.DB }

func NewGormUserRepository(db *gorm.DB) *GormUserRepository { return &GormUserRepository{db} }

func (r *GormUserRepository) FindByID(id uint) (*domain.User, error) {
	var m GormUser
	if err := r.db.Where("id = ? AND deleted = false", id).First(&m).Error; err != nil {
		return nil, err
	}
	u := gormToUser(&m)
	u.Roles = r.loadRoles(id)
	return u, nil
}

func (r *GormUserRepository) FindByUsername(username string) (*domain.User, error) {
	var m GormUser
	if err := r.db.Where("username = ? AND deleted = false", username).First(&m).Error; err != nil {
		return nil, err
	}
	u := gormToUser(&m)
	u.Roles = r.loadRoles(m.ID)
	return u, nil
}

func (r *GormUserRepository) FindByEmail(email string) (*domain.User, error) {
	var m GormUser
	if err := r.db.Where("email = ? AND deleted = false", email).First(&m).Error; err != nil {
		return nil, err
	}
	u := gormToUser(&m)
	u.Roles = r.loadRoles(m.ID)
	return u, nil
}

func (r *GormUserRepository) List(spec interface{}) ([]*domain.User, int64, error) {
	q := r.db.Model(&GormUser{}).Where("deleted = false")
	if s, ok := spec.(specification.Specification); ok {
		sql, args := s.ToSQL()
		q = q.Where(sql, args...)
	}
	var total int64
	q.Count(&total)
	var models []GormUser
	if err := q.Order("id DESC").Find(&models).Error; err != nil {
		return nil, 0, err
	}
	users := make([]*domain.User, len(models))
	for i, m := range models {
		u := gormToUser(&m)
		u.Roles = r.loadRoles(m.ID)
		users[i] = u
	}
	return users, total, nil
}

func (r *GormUserRepository) Save(u *domain.User) error {
	m := userToGorm(u)
	var err error
	if m.ID == 0 {
		err = r.db.Create(m).Error
	} else {
		err = r.db.Save(m).Error
	}
	u.ID = m.ID
	return err
}

func (r *GormUserRepository) Delete(id uint) error {
	return r.db.Model(&GormUser{}).Where("id = ?", id).Update("deleted", true).Error
}

func (r *GormUserRepository) SetRoles(userID uint, roleIDs []uint) error {
	r.db.Model(&GormUserRole{}).Where("user_id = ?", userID).Update("deleted", true)
	for _, rid := range roleIDs {
		var ur GormUserRole
		r.db.Where("user_id = ? AND role_id = ?", userID, rid).First(&ur)
		if ur.ID == 0 {
			r.db.Create(&GormUserRole{UserID: userID, RoleID: rid, Deleted: false})
		} else {
			r.db.Model(&ur).Update("deleted", false)
		}
	}
	return nil
}

func (r *GormUserRepository) UpdateLastLogin(userID uint) error {
	now := time.Now()
	return r.db.Model(&GormUser{}).Where("id = ?", userID).
		Updates(map[string]interface{}{"last_login": now, "failed_logins": 0, "locked_until": nil}).Error
}

func (r *GormUserRepository) UpdateFailedLogin(userID uint, count int, lockedUntil *time.Time) error {
	updates := map[string]interface{}{"failed_logins": count}
	if lockedUntil != nil {
		updates["locked_until"] = lockedUntil
		updates["status"] = "locked"
	}
	return r.db.Model(&GormUser{}).Where("id = ?", userID).Updates(updates).Error
}

func (r *GormUserRepository) loadRoles(userID uint) []*domain.Role {
	type row struct {
		RoleID      uint
		Name        string
		Description string
		PermCode    string
		Scope       string
	}
	var rows []row
	r.db.Raw(`
		SELECT r.id as role_id, r.name, r.description, pd.code as perm_code, rp.scope
		FROM sys_user_roles ur
		JOIN sys_roles r ON r.id = ur.role_id AND r.deleted = false
		LEFT JOIN sys_role_permissions rp ON rp.role_id = r.id AND rp.deleted = false
		LEFT JOIN sys_permission_defs pd ON pd.id = rp.permission_id AND pd.deleted = false
		WHERE ur.user_id = ? AND ur.deleted = false
	`, userID).Scan(&rows)

	roleMap := make(map[uint]*domain.Role)
	for _, row := range rows {
		if _, ok := roleMap[row.RoleID]; !ok {
			roleMap[row.RoleID] = &domain.Role{
				ID:          row.RoleID,
				Name:        row.Name,
				Description: row.Description,
			}
		}
		if row.PermCode != "" {
			roleMap[row.RoleID].Permissions = append(roleMap[row.RoleID].Permissions, &domain.RolePermission{
				Code:  permission.Permission(row.PermCode),
				Scope: permission.Scope(row.Scope),
			})
		}
	}
	roles := make([]*domain.Role, 0, len(roleMap))
	for _, r := range roleMap {
		roles = append(roles, r)
	}
	return roles
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

func gormToUser(m *GormUser) *domain.User {
	return &domain.User{
		ID:                m.ID,
		Username:          m.Username,
		PasswordHash:      m.PasswordHash,
		Email:             m.Email,
		FullName:          m.FullName,
		Phone:             m.Phone,
		Status:            m.Status,
		FailedLogins:      m.FailedLogins,
		LockedUntil:       m.LockedUntil,
		LastLogin:         m.LastLogin,
		CreatedAt:         m.CreatedAt,
		UpdatedAt:         m.UpdatedAt,
		Deleted:           m.Deleted,
		PasswordExpiresAt: m.PasswordExpiresAt,
		OneTimePassword:   m.OneTimePassword,
		RequireOTP:        m.RequireOTP,
		TwoFactorEnabled:  m.TwoFactorEnabled,
	}
}

func userToGorm(u *domain.User) *GormUser {
	return &GormUser{
		ID:                u.ID,
		Username:          u.Username,
		PasswordHash:      u.PasswordHash,
		Email:             u.Email,
		FullName:          u.FullName,
		Phone:             u.Phone,
		Status:            u.Status,
		FailedLogins:      u.FailedLogins,
		LockedUntil:       u.LockedUntil,
		LastLogin:         u.LastLogin,
		Deleted:           u.Deleted,
		PasswordExpiresAt: u.PasswordExpiresAt,
		OneTimePassword:   u.OneTimePassword,
		RequireOTP:        u.RequireOTP,
		TwoFactorEnabled:  u.TwoFactorEnabled,
	}
}

// ─── Role Repository ──────────────────────────────────────────────────────────

type GormRoleRepository struct{ db *gorm.DB }

func NewGormRoleRepository(db *gorm.DB) *GormRoleRepository { return &GormRoleRepository{db} }

func (r *GormRoleRepository) FindByID(id uint) (*domain.Role, error) {
	var m GormRole
	if err := r.db.Where("id = ? AND deleted = false", id).First(&m).Error; err != nil {
		return nil, err
	}
	role := &domain.Role{ID: m.ID, Name: m.Name, Description: m.Description, CreatedBy: m.CreatedBy, CreatedAt: m.CreatedAt}
	role.Permissions = r.loadPermissions(id)
	return role, nil
}

func (r *GormRoleRepository) List(spec interface{}) ([]*domain.Role, int64, error) {
	q := r.db.Model(&GormRole{}).Where("deleted = false")
	if s, ok := spec.(specification.Specification); ok {
		sql, args := s.ToSQL()
		q = q.Where(sql, args...)
	}
	var total int64
	q.Count(&total)
	var models []GormRole
	if err := q.Order("id DESC").Find(&models).Error; err != nil {
		return nil, 0, err
	}
	roles := make([]*domain.Role, len(models))
	for i, m := range models {
		role := &domain.Role{ID: m.ID, Name: m.Name, Description: m.Description, CreatedAt: m.CreatedAt}
		role.Permissions = r.loadPermissions(m.ID)
		roles[i] = role
	}
	return roles, total, nil
}

func (r *GormRoleRepository) Save(role *domain.Role) error {
	m := &GormRole{ID: role.ID, Name: role.Name, Description: role.Description, CreatedBy: role.CreatedBy, CreatedAt: role.CreatedAt}
	if m.ID == 0 {
		m.CreatedAt = time.Now()
		return r.db.Create(m).Error
	}
	err := r.db.Save(m).Error
	role.ID = m.ID
	return err
}

func (r *GormRoleRepository) Delete(id uint) error {
	return r.db.Model(&GormRole{}).Where("id = ?", id).Update("deleted", true).Error
}

func (r *GormRoleRepository) GetUserCount(roleID uint) int64 {
	var count int64
	r.db.Model(&GormUserRole{}).Where("role_id = ? AND deleted = false", roleID).Count(&count)
	return count
}

func (r *GormRoleRepository) AssignPermissions(roleID uint, perms []domain.RolePermission) error {
	// Soft-delete existing
	r.db.Model(&GormRolePermission{}).Where("role_id = ?", roleID).Update("deleted", true)
	for _, p := range perms {
		// Lookup permission def
		var def GormPermissionDef
		if err := r.db.Where("code = ? AND deleted = false", string(p.Code)).First(&def).Error; err != nil {
			continue
		}
		// Upsert
		var existing GormRolePermission
		r.db.Where("role_id = ? AND permission_id = ?", roleID, def.ID).First(&existing)
		if existing.ID == 0 {
			r.db.Create(&GormRolePermission{RoleID: roleID, PermissionID: def.ID, Scope: string(p.Scope)})
		} else {
			r.db.Model(&existing).Updates(map[string]interface{}{"deleted": false, "scope": string(p.Scope)})
		}
	}
	return nil
}

func (r *GormRoleRepository) loadPermissions(roleID uint) []*domain.RolePermission {
	type row struct {
		PermID uint
		Code   string
		Scope  string
	}
	var rows []row
	r.db.Raw(`
		SELECT pd.id as perm_id, pd.code, rp.scope
		FROM sys_role_permissions rp
		JOIN sys_permission_defs pd ON pd.id = rp.permission_id AND pd.deleted = false
		WHERE rp.role_id = ? AND rp.deleted = false
	`, roleID).Scan(&rows)

	perms := make([]*domain.RolePermission, len(rows))
	for i, row := range rows {
		perms[i] = &domain.RolePermission{
			ID:           row.PermID,
			PermissionID: row.PermID,
			Code:         permission.Permission(row.Code),
			Scope:        permission.Scope(row.Scope),
		}
	}
	return perms
}

// ─── Menu Repository ──────────────────────────────────────────────────────────

type GormMenuRepository struct{ db *gorm.DB }

func NewGormMenuRepository(db *gorm.DB) *GormMenuRepository { return &GormMenuRepository{db} }

func (r *GormMenuRepository) FindAll() ([]*domain.Menu, error) {
	var models []GormMenu
	if err := r.db.Where("deleted = false").Order("sort_order DESC").Find(&models).Error; err != nil {
		return nil, err
	}
	menus := make([]*domain.Menu, len(models))
	for i, m := range models {
		menus[i] = gormToMenu(&m)
	}
	return menus, nil
}

func (r *GormMenuRepository) FindByID(id uint) (*domain.Menu, error) {
	var m GormMenu
	if err := r.db.Where("id = ? AND deleted = false", id).First(&m).Error; err != nil {
		return nil, err
	}
	return gormToMenu(&m), nil
}

func (r *GormMenuRepository) Save(menu *domain.Menu) error {
	m := menuToGorm(menu)
	if m.ID == 0 {
		err := r.db.Create(m).Error
		menu.ID = m.ID
		return err
	}
	return r.db.Save(m).Error
}

func (r *GormMenuRepository) Delete(id uint) error {
	r.db.Model(&GormMenu{}).Where("parent_id = ?", id).Update("deleted", true)
	return r.db.Model(&GormMenu{}).Where("id = ?", id).Update("deleted", true).Error
}

func (r *GormMenuRepository) ListPaginated(spec interface{}) ([]*domain.Menu, int64, error) {
	q := r.db.Model(&GormMenu{}).Where("deleted = false")
	if s, ok := spec.(specification.Specification); ok {
		sql, args := s.ToSQL()
		q = q.Where(sql, args...)
	}
	var total int64
	q.Count(&total)
	var models []GormMenu
	if err := q.Order("sort_order DESC").Find(&models).Error; err != nil {
		return nil, 0, err
	}
	menus := make([]*domain.Menu, len(models))
	for i, m := range models {
		menus[i] = gormToMenu(&m)
	}
	return menus, total, nil
}

func gormToMenu(m *GormMenu) *domain.Menu {
	return &domain.Menu{
		ID:             m.ID,
		Title:          m.Title,
		URL:            m.URL,
		SortOrder:      m.SortOrder,
		Icon:           m.Icon,
		PermissionCode: permission.Permission(m.PermissionCode),
		ParentID:       m.ParentID,
		MenuType:       m.MenuType,
		Deleted:        m.Deleted,
	}
}

func menuToGorm(m *domain.Menu) *GormMenu {
	return &GormMenu{
		ID:             m.ID,
		Title:          m.Title,
		URL:            m.URL,
		SortOrder:      m.SortOrder,
		Icon:           m.Icon,
		PermissionCode: string(m.PermissionCode),
		ParentID:       m.ParentID,
		MenuType:       m.MenuType,
		Deleted:        m.Deleted,
	}
}

// ─── Refresh Token Repository ─────────────────────────────────────────────────

type GormTokenRepository struct{ db *gorm.DB }

func NewGormTokenRepository(db *gorm.DB) *GormTokenRepository { return &GormTokenRepository{db} }

func (r *GormTokenRepository) Save(t *domain.RefreshToken) error {
	m := &GormRefreshToken{UserID: t.UserID, Token: t.Token, ExpiresAt: t.ExpiresAt}
	return r.db.Create(m).Error
}

func (r *GormTokenRepository) FindByToken(token string) (*domain.RefreshToken, error) {
	var m GormRefreshToken
	if err := r.db.Where("token = ? AND revoked = false", token).First(&m).Error; err != nil {
		return nil, err
	}
	return &domain.RefreshToken{
		ID: m.ID, UserID: m.UserID, Token: m.Token,
		ExpiresAt: m.ExpiresAt, Revoked: m.Revoked, CreatedAt: m.CreatedAt,
	}, nil
}

func (r *GormTokenRepository) RevokeByUserID(userID uint) error {
	return r.db.Model(&GormRefreshToken{}).Where("user_id = ?", userID).Update("revoked", true).Error
}

func (r *GormTokenRepository) RevokeToken(token string) error {
	return r.db.Model(&GormRefreshToken{}).Where("token = ?", token).Update("revoked", true).Error
}

// ─── Permission Repository ────────────────────────────────────────────────────

func NewGormPermissionRepository(db *gorm.DB) *GormPermissionRepository {
	return &GormPermissionRepository{db}
}

type GormPermissionRepository struct{ db *gorm.DB }

func (r *GormPermissionRepository) SyncFromRegistry() {
	for _, group := range permission.Registry {
		for _, perm := range group.Permissions {
			var existing GormPermissionDef
			if r.db.Where("code = ?", string(perm)).First(&existing).Error != nil {
				r.db.Create(&GormPermissionDef{Code: string(perm), Name: string(perm), GroupName: group.Name})
			}
		}
	}
	// Wildcard
	var w GormPermissionDef
	if r.db.Where("code = ?", "*").First(&w).Error != nil {
		r.db.Create(&GormPermissionDef{Code: "*", Name: "Wildcard (Super Admin)", GroupName: "system"})
	}
}

func (r *GormPermissionRepository) FindAll() ([]*domain.PermissionDef, error) {
	var models []GormPermissionDef
	if err := r.db.Where("deleted = false").Order("group_name, code").Find(&models).Error; err != nil {
		return nil, err
	}
	defs := make([]*domain.PermissionDef, len(models))
	for i, m := range models {
		defs[i] = &domain.PermissionDef{ID: m.ID, Code: permission.Permission(m.Code), Name: m.Name, Description: m.Description, GroupName: m.GroupName}
	}
	return defs, nil
}

func (r *GormPermissionRepository) FindByCode(code permission.Permission) (*domain.PermissionDef, error) {
	var m GormPermissionDef
	if err := r.db.Where("code = ? AND deleted = false", string(code)).First(&m).Error; err != nil {
		return nil, err
	}
	return &domain.PermissionDef{ID: m.ID, Code: permission.Permission(m.Code), Name: m.Name, GroupName: m.GroupName}, nil
}

func (r *GormPermissionRepository) FindByUserID(userID uint) ([]*domain.RolePermission, error) {
	type row struct{ Code, Scope string }
	var rows []row
	r.db.Raw(`
		SELECT pd.code, rp.scope FROM sys_role_permissions rp
		JOIN sys_permission_defs pd ON pd.id = rp.permission_id AND pd.deleted = false
		JOIN sys_user_roles ur ON ur.role_id = rp.role_id AND ur.deleted = false
		WHERE ur.user_id = ? AND rp.deleted = false
	`, userID).Scan(&rows)
	result := make([]*domain.RolePermission, len(rows))
	for i, row := range rows {
		result[i] = &domain.RolePermission{Code: permission.Permission(row.Code), Scope: permission.Scope(row.Scope)}
	}
	return result, nil
}

func (r *GormPermissionRepository) Save(p *domain.PermissionDef) error {
	m := &GormPermissionDef{ID: p.ID, Code: string(p.Code), Name: p.Name, Description: p.Description, GroupName: p.GroupName}
	var err error
	if m.ID == 0 {
		err = r.db.Create(m).Error
	} else {
		err = r.db.Save(m).Error
	}
	p.ID = m.ID
	return err
}

func (r *GormPermissionRepository) AddLine(line *domain.PermissionLine) error {
	m := &GormPermissionLine{
		PermissionID: line.PermissionID, Controller: line.Controller,
		Action: line.Action, Note: line.Note, CreatedBy: line.CreatedBy, CreatedAt: time.Now(),
	}
	err := r.db.Create(m).Error
	line.ID = m.ID
	return err
}

func (r *GormPermissionRepository) DeleteLine(id uint) error {
	return r.db.Model(&GormPermissionLine{}).Where("id = ?", id).Update("deleted", true).Error
}

func (r *GormPermissionRepository) GetLines(permID uint) ([]*domain.PermissionLine, error) {
	var models []GormPermissionLine
	if err := r.db.Where("permission_id = ? AND deleted = false", permID).Find(&models).Error; err != nil {
		return nil, err
	}
	lines := make([]*domain.PermissionLine, len(models))
	for i, m := range models {
		lines[i] = &domain.PermissionLine{ID: m.ID, PermissionID: m.PermissionID, Controller: m.Controller, Action: m.Action, Note: m.Note}
	}
	return lines, nil
}

// ─── Audit Log Repository ─────────────────────────────────────────────────────

func NewGormAuditLogRepository(db *gorm.DB) *GormAuditLogRepository {
	return &GormAuditLogRepository{db}
}

type GormAuditLogRepository struct{ db *gorm.DB }

func (r *GormAuditLogRepository) Save(log *domain.AuditLog) error {
	m := &GormAuditLog{
		UserID: log.UserID, Username: log.Username, Action: log.Action,
		Resource: log.Resource, ResourceID: log.ResourceID, IPAddress: log.IPAddress,
		UserAgent: log.UserAgent, Request: log.Request, Response: log.Response,
		Allowed: log.Allowed, CreatedAt: time.Now(),
	}
	return r.db.Create(m).Error
}

func (r *GormAuditLogRepository) List(spec interface{}) ([]*domain.AuditLog, int64, error) {
	var models []GormAuditLog
	var total int64
	query := r.db.Model(&GormAuditLog{})

	if s, ok := spec.(map[string]interface{}); ok {
		if v, exists := s["search"]; exists && v != "" {
			searchStr, ok := v.(string)
			if !ok {
				fmt.Printf("DEBUG: AuditLog Search is not a string: %T\n", v)
			} else {
				search := "%" + searchStr + "%"
				query = query.Where("(username LIKE ? OR action LIKE ? OR resource LIKE ? OR request LIKE ? OR response LIKE ?)",
					search, search, search, search, search)
			}
		}
		if v, exists := s["user"]; exists && v != "" {
			query = query.Where("username = ?", v)
		}
		if v, exists := s["action"]; exists && v != "" {
			query = query.Where("action = ?", v)
		}
		if v, exists := s["from"]; exists && v != "" {
			query = query.Where("created_at >= ?", v)
		}
		if v, exists := s["to"]; exists && v != "" {
			query = query.Where("created_at <= ?", v)
		}
	}

	query.Count(&total)
	query = query.Order("created_at DESC")

	if s, ok := spec.(map[string]interface{}); ok {
		page := 1
		pageSize := 10
		if p, exists := s["page"]; exists {
			switch val := p.(type) {
			case int:
				page = val
			case float64:
				page = int(val)
			default:
				fmt.Printf("DEBUG: AuditLog Page is unexpected type: %T\n", p)
			}
		}
		if ps, exists := s["page_size"]; exists {
			switch val := ps.(type) {
			case int:
				pageSize = val
			case float64:
				pageSize = int(val)
			default:
				fmt.Printf("DEBUG: AuditLog PageSize is unexpected type: %T\n", ps)
			}
		}
		if page > 0 && pageSize > 0 {
			query = query.Offset((page - 1) * pageSize).Limit(pageSize)
		}
	}

	if err := query.Find(&models).Error; err != nil {
		return nil, 0, err
	}

	result := make([]*domain.AuditLog, len(models))
	for i, m := range models {
		result[i] = &domain.AuditLog{
			ID: m.ID, UserID: m.UserID, Username: m.Username, Action: m.Action,
			Resource: m.Resource, ResourceID: m.ResourceID, IPAddress: m.IPAddress,
			UserAgent: m.UserAgent, Request: m.Request, Response: m.Response,
			Allowed: m.Allowed, CreatedAt: m.CreatedAt,
		}
	}
	return result, total, nil
}

// ─── Auth History Repository ──────────────────────────────────────────────────

func NewGormAuthHistoryRepository(db *gorm.DB) *GormAuthHistoryRepository {
	return &GormAuthHistoryRepository{db}
}

type GormAuthHistoryRepository struct{ db *gorm.DB }

func (r *GormAuthHistoryRepository) Save(h *domain.AuthHistory) error {
	m := &GormAuthHistory{
		UserID: h.UserID, Username: h.Username, IPAddress: h.IPAddress,
		UserAgent: h.UserAgent, Status: h.Status, Note: h.Note, CreatedAt: time.Now(),
	}
	return r.db.Create(m).Error
}

func (r *GormAuthHistoryRepository) List(spec interface{}) ([]*domain.AuthHistory, int64, error) {
	var models []GormAuthHistory
	var total int64
	query := r.db.Model(&GormAuthHistory{})

	if s, ok := spec.(map[string]interface{}); ok {
		if v, exists := s["search"]; exists && v != "" {
			searchStr, ok := v.(string)
			if !ok {
				fmt.Printf("DEBUG: AuthHistory Search is not a string: %T\n", v)
			} else {
				search := "%" + searchStr + "%"
				query = query.Where("username LIKE ? OR ip_address LIKE ? OR note LIKE ?", search, search, search)
			}
		}
	}

	query.Count(&total)
	query = query.Order("created_at DESC")

	if s, ok := spec.(map[string]interface{}); ok {
		page := 1
		pageSize := 10
		if p, exists := s["page"]; exists {
			switch val := p.(type) {
			case int:
				page = val
			case float64:
				page = int(val)
			default:
				fmt.Printf("DEBUG: AuthHistory Page is unexpected type: %T\n", p)
			}
		}
		if ps, exists := s["page_size"]; exists {
			switch val := ps.(type) {
			case int:
				pageSize = val
			case float64:
				pageSize = int(val)
			default:
				fmt.Printf("DEBUG: AuthHistory PageSize is unexpected type: %T\n", ps)
			}
		}
		if page > 0 && pageSize > 0 {
			query = query.Offset((page - 1) * pageSize).Limit(pageSize)
		}
	}

	if err := query.Find(&models).Error; err != nil {
		return nil, 0, err
	}

	result := make([]*domain.AuthHistory, len(models))
	for i, m := range models {
		result[i] = &domain.AuthHistory{
			ID: m.ID, UserID: m.UserID, Username: m.Username, IPAddress: m.IPAddress,
			UserAgent: m.UserAgent, Status: m.Status, Note: m.Note, CreatedAt: m.CreatedAt,
		}
	}
	return result, total, nil
}

package persistence

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/owner/auth-server/internal/authorization/permission"
	"github.com/owner/auth-server/internal/authorization/specification"
	"github.com/owner/auth-server/internal/domain"
	"gorm.io/gorm"
)

func decodeJSONList(raw string) []string {
	values := []string{}
	if raw != "" {
		_ = json.Unmarshal([]byte(raw), &values)
	}
	return values
}

func encodeJSONList(values []string) string {
	if len(values) == 0 {
		return "[]"
	}
	payload, err := json.Marshal(values)
	if err != nil {
		return "[]"
	}
	return string(payload)
}

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
	passwordHistory := []string{}
	if m.PasswordHistoryJSON != "" {
		_ = json.Unmarshal([]byte(m.PasswordHistoryJSON), &passwordHistory)
	}
	allowedClients := []string{}
	if m.AllowedClientsJSON != "" {
		_ = json.Unmarshal([]byte(m.AllowedClientsJSON), &allowedClients)
	}
	allowedChannels := []string{}
	if m.AllowedChannelsJSON != "" {
		_ = json.Unmarshal([]byte(m.AllowedChannelsJSON), &allowedChannels)
	}
	return &domain.User{
		ID:                m.ID,
		Username:          m.Username,
		PasswordHash:      m.PasswordHash,
		PasswordHistory:   passwordHistory,
		AllowedClients:    allowedClients,
		AllowedChannels:   allowedChannels,
		EmailVerified:     m.EmailVerified,
		EmailOTPHash:      m.EmailOTPHash,
		EmailOTPExpiresAt: m.EmailOTPExpiresAt,
		EmailVerifyHash:   m.EmailVerifyHash,
		EmailVerifyExpiry: m.EmailVerifyExpiry,
		TOTPSecret:        m.TOTPSecret,
		PendingTOTPSecret: m.PendingTOTPSecret,
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
	passwordHistoryJSON := "[]"
	if len(u.PasswordHistory) > 0 {
		if payload, err := json.Marshal(u.PasswordHistory); err == nil {
			passwordHistoryJSON = string(payload)
		}
	}
	allowedClientsJSON := "[]"
	if len(u.AllowedClients) > 0 {
		if payload, err := json.Marshal(u.AllowedClients); err == nil {
			allowedClientsJSON = string(payload)
		}
	}
	allowedChannelsJSON := "[]"
	if len(u.AllowedChannels) > 0 {
		if payload, err := json.Marshal(u.AllowedChannels); err == nil {
			allowedChannelsJSON = string(payload)
		}
	}
	return &GormUser{
		ID:                  u.ID,
		Username:            u.Username,
		PasswordHash:        u.PasswordHash,
		PasswordHistoryJSON: passwordHistoryJSON,
		AllowedClientsJSON:  allowedClientsJSON,
		AllowedChannelsJSON: allowedChannelsJSON,
		EmailVerified:       u.EmailVerified,
		EmailOTPHash:        u.EmailOTPHash,
		EmailOTPExpiresAt:   u.EmailOTPExpiresAt,
		EmailVerifyHash:     u.EmailVerifyHash,
		EmailVerifyExpiry:   u.EmailVerifyExpiry,
		TOTPSecret:          u.TOTPSecret,
		PendingTOTPSecret:   u.PendingTOTPSecret,
		Email:               u.Email,
		FullName:            u.FullName,
		Phone:               u.Phone,
		Status:              u.Status,
		FailedLogins:        u.FailedLogins,
		LockedUntil:         u.LockedUntil,
		LastLogin:           u.LastLogin,
		Deleted:             u.Deleted,
		PasswordExpiresAt:   u.PasswordExpiresAt,
		OneTimePassword:     u.OneTimePassword,
		RequireOTP:          u.RequireOTP,
		TwoFactorEnabled:    u.TwoFactorEnabled,
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
	m := &GormRefreshToken{
		UserID:            t.UserID,
		Token:             t.Token,
		SessionID:         t.SessionID,
		TokenFamily:       t.TokenFamily,
		ClientID:          t.ClientID,
		DeviceName:        t.DeviceName,
		DeviceFingerprint: t.DeviceFingerprint,
		IPAddress:         t.IPAddress,
		UserAgent:         t.UserAgent,
		Trusted:           t.Trusted,
		RotatedFrom:       t.RotatedFrom,
		RevokedReason:     t.RevokedReason,
		ExpiresAt:         t.ExpiresAt,
		LastUsedAt:        t.LastUsedAt,
		ReuseDetectedAt:   t.ReuseDetectedAt,
		Revoked:           t.Revoked,
	}
	return r.db.Create(m).Error
}

func (r *GormTokenRepository) FindByToken(token string) (*domain.RefreshToken, error) {
	var m GormRefreshToken
	if err := r.db.Where("token = ? AND revoked = false", token).First(&m).Error; err != nil {
		if err := r.db.Where("token = ?", token).First(&m).Error; err != nil {
			return nil, err
		}
	}
	return &domain.RefreshToken{
		ID:                m.ID,
		UserID:            m.UserID,
		Token:             m.Token,
		SessionID:         m.SessionID,
		TokenFamily:       m.TokenFamily,
		ClientID:          m.ClientID,
		DeviceName:        m.DeviceName,
		DeviceFingerprint: m.DeviceFingerprint,
		IPAddress:         m.IPAddress,
		UserAgent:         m.UserAgent,
		Trusted:           m.Trusted,
		RotatedFrom:       m.RotatedFrom,
		RevokedReason:     m.RevokedReason,
		ExpiresAt:         m.ExpiresAt,
		LastUsedAt:        m.LastUsedAt,
		ReuseDetectedAt:   m.ReuseDetectedAt,
		Revoked:           m.Revoked,
		CreatedAt:         m.CreatedAt,
	}, nil
}

func (r *GormTokenRepository) RevokeByUserID(userID uint) error {
	return r.db.Model(&GormRefreshToken{}).Where("user_id = ?", userID).Updates(map[string]interface{}{"revoked": true, "revoked_reason": "user_logout_all"}).Error
}

func (r *GormTokenRepository) RevokeToken(token string) error {
	return r.db.Model(&GormRefreshToken{}).Where("token = ?", token).Updates(map[string]interface{}{"revoked": true, "revoked_reason": "token_rotated"}).Error
}

func (r *GormTokenRepository) RevokeSession(userID uint, sessionID string) error {
	return r.db.Model(&GormRefreshToken{}).
		Where("user_id = ? AND session_id = ?", userID, sessionID).
		Updates(map[string]interface{}{"revoked": true, "revoked_reason": "session_revoked"}).Error
}

func (r *GormTokenRepository) RevokeSessionByID(sessionID string) error {
	return r.db.Model(&GormRefreshToken{}).
		Where("session_id = ?", sessionID).
		Updates(map[string]interface{}{"revoked": true, "revoked_reason": "admin_session_revoked"}).Error
}

func (r *GormTokenRepository) RevokeFamily(familyID string, reason string) error {
	return r.db.Model(&GormRefreshToken{}).
		Where("token_family = ?", familyID).
		Updates(map[string]interface{}{"revoked": true, "revoked_reason": reason}).Error
}

func (r *GormTokenRepository) ListActiveSessions(userID uint) ([]*domain.RefreshToken, error) {
	var models []GormRefreshToken
	if err := r.db.
		Where("user_id = ? AND revoked = false AND expires_at > ?", userID, time.Now()).
		Order("last_used_at DESC, created_at DESC").
		Find(&models).Error; err != nil {
		return nil, err
	}
	result := make([]*domain.RefreshToken, 0, len(models))
	seen := map[string]bool{}
	for _, m := range models {
		if m.SessionID == "" || seen[m.SessionID] {
			continue
		}
		seen[m.SessionID] = true
		result = append(result, &domain.RefreshToken{
			ID:                m.ID,
			UserID:            m.UserID,
			Token:             m.Token,
			SessionID:         m.SessionID,
			TokenFamily:       m.TokenFamily,
			ClientID:          m.ClientID,
			DeviceName:        m.DeviceName,
			DeviceFingerprint: m.DeviceFingerprint,
			IPAddress:         m.IPAddress,
			UserAgent:         m.UserAgent,
			Trusted:           m.Trusted,
			RotatedFrom:       m.RotatedFrom,
			RevokedReason:     m.RevokedReason,
			ExpiresAt:         m.ExpiresAt,
			LastUsedAt:        m.LastUsedAt,
			ReuseDetectedAt:   m.ReuseDetectedAt,
			Revoked:           m.Revoked,
			CreatedAt:         m.CreatedAt,
		})
	}
	return result, nil
}

func (r *GormTokenRepository) ListSessions(filters map[string]interface{}) ([]*domain.RefreshToken, int64, error) {
	type row struct {
		GormRefreshToken
		Username string
		Email    string
	}
	q := r.db.Table("sys_refresh_tokens rt").
		Select("rt.*, u.username, u.email").
		Joins("JOIN sys_users u ON u.id = rt.user_id").
		Where("rt.revoked = false AND rt.expires_at > ? AND u.deleted = false", time.Now())

	if search, ok := filters["search"].(string); ok && strings.TrimSpace(search) != "" {
		like := "%" + strings.TrimSpace(search) + "%"
		q = q.Where("(u.username ILIKE ? OR u.email ILIKE ? OR rt.device_name ILIKE ? OR rt.client_id ILIKE ? OR rt.ip_address ILIKE ?)", like, like, like, like, like)
	}
	if clientID, ok := filters["client_id"].(string); ok && strings.TrimSpace(clientID) != "" {
		q = q.Where("rt.client_id = ?", strings.TrimSpace(clientID))
	}
	if trustedValue, ok := filters["trusted"].(string); ok && strings.TrimSpace(trustedValue) != "" {
		trusted := strings.EqualFold(trustedValue, "true")
		q = q.Where("rt.trusted = ?", trusted)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page, _ := filters["page"].(int)
	pageSize, _ := filters["page_size"].(int)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	var rows []row
	if err := q.Order("rt.last_used_at DESC, rt.created_at DESC").Offset(offset).Limit(pageSize).Find(&rows).Error; err != nil {
		return nil, 0, err
	}

	result := make([]*domain.RefreshToken, 0, len(rows))
	seen := map[string]bool{}
	for _, item := range rows {
		if item.SessionID == "" || seen[item.SessionID] {
			continue
		}
		seen[item.SessionID] = true
		result = append(result, &domain.RefreshToken{
			ID:                item.ID,
			UserID:            item.UserID,
			Username:          item.Username,
			UserEmail:         item.Email,
			Token:             item.Token,
			SessionID:         item.SessionID,
			TokenFamily:       item.TokenFamily,
			ClientID:          item.ClientID,
			DeviceName:        item.DeviceName,
			DeviceFingerprint: item.DeviceFingerprint,
			IPAddress:         item.IPAddress,
			UserAgent:         item.UserAgent,
			Trusted:           item.Trusted,
			RotatedFrom:       item.RotatedFrom,
			RevokedReason:     item.RevokedReason,
			ExpiresAt:         item.ExpiresAt,
			LastUsedAt:        item.LastUsedAt,
			ReuseDetectedAt:   item.ReuseDetectedAt,
			Revoked:           item.Revoked,
			CreatedAt:         item.CreatedAt,
		})
	}
	return result, total, nil
}

func (r *GormTokenRepository) FindTrustedDevice(userID uint, clientID, fingerprint string) (*domain.RefreshToken, error) {
	var m GormRefreshToken
	if err := r.db.
		Where("user_id = ? AND client_id = ? AND device_fingerprint = ? AND trusted = true AND revoked = false AND expires_at > ?", userID, clientID, fingerprint, time.Now()).
		Order("last_used_at DESC, created_at DESC").
		First(&m).Error; err != nil {
		return nil, err
	}
	return &domain.RefreshToken{
		ID:                m.ID,
		UserID:            m.UserID,
		Token:             m.Token,
		SessionID:         m.SessionID,
		TokenFamily:       m.TokenFamily,
		ClientID:          m.ClientID,
		DeviceName:        m.DeviceName,
		DeviceFingerprint: m.DeviceFingerprint,
		IPAddress:         m.IPAddress,
		UserAgent:         m.UserAgent,
		Trusted:           m.Trusted,
		RotatedFrom:       m.RotatedFrom,
		RevokedReason:     m.RevokedReason,
		ExpiresAt:         m.ExpiresAt,
		LastUsedAt:        m.LastUsedAt,
		ReuseDetectedAt:   m.ReuseDetectedAt,
		Revoked:           m.Revoked,
		CreatedAt:         m.CreatedAt,
	}, nil
}

// ─── Auth Client Repository ──────────────────────────────────────────────────

type GormClientRepository struct{ db *gorm.DB }

func NewGormClientRepository(db *gorm.DB) *GormClientRepository { return &GormClientRepository{db} }

func (r *GormClientRepository) FindByClientID(clientID string) (*domain.AuthClient, error) {
	var model GormAuthClient
	if err := r.db.Where("client_id = ?", clientID).First(&model).Error; err != nil {
		return nil, err
	}
	return gormToClient(&model), nil
}

func (r *GormClientRepository) List(filters map[string]interface{}) ([]*domain.AuthClient, int64, error) {
	q := r.db.Model(&GormAuthClient{})
	if search, ok := filters["search"].(string); ok && strings.TrimSpace(search) != "" {
		like := "%" + strings.TrimSpace(search) + "%"
		q = q.Where("client_id ILIKE ? OR name ILIKE ? OR app_type ILIKE ? OR client_template ILIKE ? OR environment ILIKE ? OR domain_group ILIKE ? OR owner_team ILIKE ? OR approval_status ILIKE ?",
			like, like, like, like, like, like, like, like)
	}
	if appType, ok := filters["app_type"].(string); ok && strings.TrimSpace(appType) != "" {
		q = q.Where("app_type = ?", strings.TrimSpace(appType))
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	page, _ := filters["page"].(int)
	pageSize, _ := filters["page_size"].(int)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	var models []GormAuthClient
	if err := q.Order("id DESC").Offset(offset).Limit(pageSize).Find(&models).Error; err != nil {
		return nil, 0, err
	}
	result := make([]*domain.AuthClient, len(models))
	for i, item := range models {
		result[i] = gormToClient(&item)
	}
	return result, total, nil
}

func (r *GormClientRepository) Save(client *domain.AuthClient) error {
	model := clientToGorm(client)
	var err error
	if model.ID == 0 {
		err = r.db.Create(model).Error
	} else {
		err = r.db.Save(model).Error
	}
	client.ID = model.ID
	return err
}

func (r *GormClientRepository) Delete(id uint) error {
	return r.db.Delete(&GormAuthClient{}, id).Error
}

func gormToClient(model *GormAuthClient) *domain.AuthClient {
	return &domain.AuthClient{
		ID:                  model.ID,
		ClientID:            model.ClientID,
		ClientSecret:        model.ClientSecret,
		Name:                model.Name,
		Description:         model.Description,
		AppType:             model.AppType,
		ClientTemplate:      model.ClientTemplate,
		Environment:         model.Environment,
		DomainGroup:         model.DomainGroup,
		OwnerTeam:           model.OwnerTeam,
		Public:              model.Public,
		PKCERequired:        model.PKCERequired,
		Active:              model.Active,
		LegacyPasswordGrant: model.LegacyPasswordGrant,
		ApprovalStatus:      model.ApprovalStatus,
		GrantTypes:          decodeJSONList(model.GrantTypesJSON),
		RedirectURIs:        decodeJSONList(model.RedirectURIsJSON),
		Audiences:           decodeJSONList(model.AudiencesJSON),
		Channels:            decodeJSONList(model.ChannelsJSON),
		TrustedTypes:        decodeJSONList(model.TrustedTypesJSON),
		Tags:                decodeJSONList(model.TagsJSON),
		SecretVersion:       model.SecretVersion,
		SecretRotatedAt:     model.SecretRotatedAt,
		SecretExpiresAt:     model.SecretExpiresAt,
		CreatedAt:           model.CreatedAt,
		UpdatedAt:           model.UpdatedAt,
	}
}

func clientToGorm(client *domain.AuthClient) *GormAuthClient {
	return &GormAuthClient{
		ID:                  client.ID,
		ClientID:            client.ClientID,
		ClientSecret:        client.ClientSecret,
		Name:                client.Name,
		Description:         client.Description,
		AppType:             client.AppType,
		ClientTemplate:      client.ClientTemplate,
		Environment:         client.Environment,
		DomainGroup:         client.DomainGroup,
		OwnerTeam:           client.OwnerTeam,
		Public:              client.Public,
		PKCERequired:        client.PKCERequired,
		Active:              client.Active,
		LegacyPasswordGrant: client.LegacyPasswordGrant,
		ApprovalStatus:      client.ApprovalStatus,
		GrantTypesJSON:      encodeJSONList(client.GrantTypes),
		RedirectURIsJSON:    encodeJSONList(client.RedirectURIs),
		AudiencesJSON:       encodeJSONList(client.Audiences),
		ChannelsJSON:        encodeJSONList(client.Channels),
		TrustedTypesJSON:    encodeJSONList(client.TrustedTypes),
		TagsJSON:            encodeJSONList(client.Tags),
		SecretVersion:       client.SecretVersion,
		SecretRotatedAt:     client.SecretRotatedAt,
		SecretExpiresAt:     client.SecretExpiresAt,
	}
}

// ─── SSO Provider Repository ────────────────────────────────────────────────

type GormSSOProviderRepository struct{ db *gorm.DB }

func NewGormSSOProviderRepository(db *gorm.DB) *GormSSOProviderRepository {
	return &GormSSOProviderRepository{db}
}

func (r *GormSSOProviderRepository) FindByProviderID(providerID string) (*domain.SSOProvider, error) {
	var model GormSSOProvider
	if err := r.db.Where("provider_id = ?", providerID).First(&model).Error; err != nil {
		return nil, err
	}
	return gormToSSOProvider(&model), nil
}

func (r *GormSSOProviderRepository) FindByID(id uint) (*domain.SSOProvider, error) {
	var model GormSSOProvider
	if err := r.db.First(&model, id).Error; err != nil {
		return nil, err
	}
	return gormToSSOProvider(&model), nil
}

func (r *GormSSOProviderRepository) List(filters map[string]interface{}) ([]*domain.SSOProvider, int64, error) {
	q := r.db.Model(&GormSSOProvider{})
	if search, ok := filters["search"].(string); ok && strings.TrimSpace(search) != "" {
		like := "%" + strings.TrimSpace(search) + "%"
		q = q.Where("provider_id ILIKE ? OR name ILIKE ? OR type ILIKE ?", like, like, like)
	}
	if providerType, ok := filters["type"].(string); ok && strings.TrimSpace(providerType) != "" {
		q = q.Where("type = ?", strings.TrimSpace(providerType))
	}
	if enabled, ok := filters["enabled"].(string); ok && strings.TrimSpace(enabled) != "" {
		q = q.Where("enabled = ?", strings.EqualFold(enabled, "true"))
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	page, _ := filters["page"].(int)
	pageSize, _ := filters["page_size"].(int)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	var models []GormSSOProvider
	if err := q.Order("id DESC").Offset(offset).Limit(pageSize).Find(&models).Error; err != nil {
		return nil, 0, err
	}
	result := make([]*domain.SSOProvider, len(models))
	for i, item := range models {
		result[i] = gormToSSOProvider(&item)
	}
	return result, total, nil
}

func (r *GormSSOProviderRepository) Save(provider *domain.SSOProvider) error {
	model := ssoProviderToGorm(provider)
	var err error
	if model.ID == 0 {
		err = r.db.Create(model).Error
	} else {
		err = r.db.Save(model).Error
	}
	provider.ID = model.ID
	return err
}

func (r *GormSSOProviderRepository) Delete(id uint) error {
	return r.db.Delete(&GormSSOProvider{}, id).Error
}

func gormToSSOProvider(model *GormSSOProvider) *domain.SSOProvider {
	return &domain.SSOProvider{
		ID:                 model.ID,
		ProviderID:         model.ProviderID,
		Name:               model.Name,
		Type:               model.Type,
		ClientID:           model.ClientID,
		ClientSecret:       model.ClientSecret,
		AuthorizeURL:       model.AuthorizeURL,
		TokenURL:           model.TokenURL,
		UserInfoURL:        model.UserInfoURL,
		RedirectURI:        model.RedirectURI,
		Scope:              model.Scope,
		SAMLLoginURL:       model.SAMLLoginURL,
		Enabled:            model.Enabled,
		AllowAutoProvision: model.AllowAutoProvision,
		Icon:               model.Icon,
		CreatedAt:          model.CreatedAt,
		UpdatedAt:          model.UpdatedAt,
	}
}

func ssoProviderToGorm(provider *domain.SSOProvider) *GormSSOProvider {
	return &GormSSOProvider{
		ID:                 provider.ID,
		ProviderID:         provider.ProviderID,
		Name:               provider.Name,
		Type:               provider.Type,
		ClientID:           provider.ClientID,
		ClientSecret:       provider.ClientSecret,
		AuthorizeURL:       provider.AuthorizeURL,
		TokenURL:           provider.TokenURL,
		UserInfoURL:        provider.UserInfoURL,
		RedirectURI:        provider.RedirectURI,
		Scope:              provider.Scope,
		SAMLLoginURL:       provider.SAMLLoginURL,
		Enabled:            provider.Enabled,
		AllowAutoProvision: provider.AllowAutoProvision,
		Icon:               provider.Icon,
	}
}

// ─── Login Channel Repository ───────────────────────────────────────────────

type GormLoginChannelRepository struct{ db *gorm.DB }

func NewGormLoginChannelRepository(db *gorm.DB) *GormLoginChannelRepository {
	return &GormLoginChannelRepository{db}
}

func (r *GormLoginChannelRepository) FindByCode(code string) (*domain.LoginChannel, error) {
	var model GormLoginChannel
	if err := r.db.Where("code = ?", code).First(&model).Error; err != nil {
		return nil, err
	}
	return gormToLoginChannel(&model), nil
}

func (r *GormLoginChannelRepository) List(filters map[string]interface{}) ([]*domain.LoginChannel, int64, error) {
	q := r.db.Model(&GormLoginChannel{})
	if search, ok := filters["search"].(string); ok && strings.TrimSpace(search) != "" {
		like := "%" + strings.TrimSpace(search) + "%"
		q = q.Where("code ILIKE ? OR name ILIKE ? OR description ILIKE ?", like, like, like)
	}
	if riskLevel, ok := filters["risk_level"].(string); ok && strings.TrimSpace(riskLevel) != "" {
		q = q.Where("risk_level = ?", strings.TrimSpace(riskLevel))
	}
	if active, ok := filters["active"].(string); ok && strings.TrimSpace(active) != "" {
		q = q.Where("active = ?", strings.EqualFold(active, "true"))
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	page, _ := filters["page"].(int)
	pageSize, _ := filters["page_size"].(int)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize
	var models []GormLoginChannel
	if err := q.Order("id DESC").Offset(offset).Limit(pageSize).Find(&models).Error; err != nil {
		return nil, 0, err
	}
	result := make([]*domain.LoginChannel, len(models))
	for i, item := range models {
		result[i] = gormToLoginChannel(&item)
	}
	return result, total, nil
}

func (r *GormLoginChannelRepository) Save(channel *domain.LoginChannel) error {
	model := loginChannelToGorm(channel)
	var err error
	if model.ID == 0 {
		err = r.db.Create(model).Error
	} else {
		err = r.db.Save(model).Error
	}
	channel.ID = model.ID
	return err
}

func (r *GormLoginChannelRepository) Delete(id uint) error {
	return r.db.Delete(&GormLoginChannel{}, id).Error
}

func gormToLoginChannel(model *GormLoginChannel) *domain.LoginChannel {
	return &domain.LoginChannel{
		ID:                    model.ID,
		Code:                  model.Code,
		Name:                  model.Name,
		Description:           model.Description,
		RiskLevel:             model.RiskLevel,
		RequireMFA:            model.RequireMFA,
		AllowPassword:         model.AllowPassword,
		AllowSSO:              model.AllowSSO,
		TrustedDeviceTTLHours: model.TrustedDeviceTTLHours,
		SessionTTLMinutes:     model.SessionTTLMinutes,
		Active:                model.Active,
		CreatedAt:             model.CreatedAt,
		UpdatedAt:             model.UpdatedAt,
	}
}

func loginChannelToGorm(channel *domain.LoginChannel) *GormLoginChannel {
	return &GormLoginChannel{
		ID:                    channel.ID,
		Code:                  channel.Code,
		Name:                  channel.Name,
		Description:           channel.Description,
		RiskLevel:             channel.RiskLevel,
		RequireMFA:            channel.RequireMFA,
		AllowPassword:         channel.AllowPassword,
		AllowSSO:              channel.AllowSSO,
		TrustedDeviceTTLHours: channel.TrustedDeviceTTLHours,
		SessionTTLMinutes:     channel.SessionTTLMinutes,
		Active:                channel.Active,
	}
}

// ─── Security Policy Repository ──────────────────────────────────────────────

type GormSecurityPolicyRepository struct{ db *gorm.DB }

func NewGormSecurityPolicyRepository(db *gorm.DB) *GormSecurityPolicyRepository {
	return &GormSecurityPolicyRepository{db}
}

func (r *GormSecurityPolicyRepository) List(filters map[string]interface{}) ([]*domain.SecurityPolicy, int64, error) {
	q := r.db.Model(&GormSecurityPolicy{})
	if search, ok := filters["search"].(string); ok && strings.TrimSpace(search) != "" {
		like := "%" + strings.TrimSpace(search) + "%"
		q = q.Where("code ILIKE ? OR name ILIKE ? OR policy_type ILIKE ? OR scope_type ILIKE ? OR target_client ILIKE ? OR target_channel ILIKE ? OR target_action ILIKE ?",
			like, like, like, like, like, like, like)
	}
	if targetAction, ok := filters["target_action"].(string); ok && strings.TrimSpace(targetAction) != "" {
		q = q.Where("target_action = ?", strings.TrimSpace(targetAction))
	}
	if policyType, ok := filters["policy_type"].(string); ok && strings.TrimSpace(policyType) != "" {
		q = q.Where("policy_type = ?", strings.TrimSpace(policyType))
	}
	if scopeType, ok := filters["scope_type"].(string); ok && strings.TrimSpace(scopeType) != "" {
		q = q.Where("scope_type = ?", strings.TrimSpace(scopeType))
	}
	if active, ok := filters["active"].(string); ok && strings.TrimSpace(active) != "" {
		q = q.Where("active = ?", strings.EqualFold(strings.TrimSpace(active), "true"))
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	page, _ := filters["page"].(int)
	pageSize, _ := filters["page_size"].(int)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize
	var models []GormSecurityPolicy
	if err := q.Order("priority ASC, id DESC").Offset(offset).Limit(pageSize).Find(&models).Error; err != nil {
		return nil, 0, err
	}
	result := make([]*domain.SecurityPolicy, len(models))
	for i, item := range models {
		result[i] = gormToSecurityPolicy(&item)
	}
	return result, total, nil
}

func (r *GormSecurityPolicyRepository) Save(policy *domain.SecurityPolicy) error {
	model := securityPolicyToGorm(policy)
	var err error
	if model.ID == 0 {
		err = r.db.Create(model).Error
	} else {
		err = r.db.Save(model).Error
	}
	policy.ID = model.ID
	return err
}

func (r *GormSecurityPolicyRepository) Delete(id uint) error {
	return r.db.Delete(&GormSecurityPolicy{}, id).Error
}

type GormReferenceOptionRepository struct{ db *gorm.DB }

func NewGormReferenceOptionRepository(db *gorm.DB) *GormReferenceOptionRepository {
	return &GormReferenceOptionRepository{db}
}

func (r *GormReferenceOptionRepository) List(filters map[string]interface{}) ([]*domain.ReferenceOption, int64, error) {
	q := r.db.Model(&GormReferenceOption{})
	if search, ok := filters["search"].(string); ok && strings.TrimSpace(search) != "" {
		like := "%" + strings.TrimSpace(search) + "%"
		q = q.Where("option_group ILIKE ? OR value ILIKE ? OR label ILIKE ? OR description ILIKE ?", like, like, like, like)
	}
	if group, ok := filters["option_group"].(string); ok && strings.TrimSpace(group) != "" {
		q = q.Where("option_group = ?", strings.TrimSpace(group))
	}
	if active, ok := filters["active"].(string); ok && strings.TrimSpace(active) != "" {
		q = q.Where("active = ?", strings.EqualFold(active, "true"))
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	page, _ := filters["page"].(int)
	pageSize, _ := filters["page_size"].(int)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	var models []GormReferenceOption
	if err := q.Order("option_group ASC, sort_order ASC, id ASC").Offset(offset).Limit(pageSize).Find(&models).Error; err != nil {
		return nil, 0, err
	}
	result := make([]*domain.ReferenceOption, len(models))
	for i, item := range models {
		result[i] = &domain.ReferenceOption{
			ID:          item.ID,
			OptionGroup: item.OptionGroup,
			Value:       item.Value,
			Label:       item.Label,
			Description: item.Description,
			MetaJSON:    item.MetaJSON,
			SortOrder:   item.SortOrder,
			Active:      item.Active,
			CreatedAt:   item.CreatedAt,
			UpdatedAt:   item.UpdatedAt,
		}
	}
	return result, total, nil
}

func (r *GormReferenceOptionRepository) FindByID(id uint) (*domain.ReferenceOption, error) {
	var model GormReferenceOption
	if err := r.db.First(&model, id).Error; err != nil {
		return nil, err
	}
	return &domain.ReferenceOption{
		ID:          model.ID,
		OptionGroup: model.OptionGroup,
		Value:       model.Value,
		Label:       model.Label,
		Description: model.Description,
		MetaJSON:    model.MetaJSON,
		SortOrder:   model.SortOrder,
		Active:      model.Active,
		CreatedAt:   model.CreatedAt,
		UpdatedAt:   model.UpdatedAt,
	}, nil
}

func (r *GormReferenceOptionRepository) Save(item *domain.ReferenceOption) error {
	model := &GormReferenceOption{
		ID:          item.ID,
		OptionGroup: item.OptionGroup,
		Value:       item.Value,
		Label:       item.Label,
		Description: item.Description,
		MetaJSON:    item.MetaJSON,
		SortOrder:   item.SortOrder,
		Active:      item.Active,
	}
	var err error
	if model.ID == 0 {
		err = r.db.Create(model).Error
	} else {
		err = r.db.Save(model).Error
	}
	item.ID = model.ID
	return err
}

func (r *GormReferenceOptionRepository) Delete(id uint) error {
	return r.db.Delete(&GormReferenceOption{}, id).Error
}

func gormToSecurityPolicy(model *GormSecurityPolicy) *domain.SecurityPolicy {
	return &domain.SecurityPolicy{
		ID:            model.ID,
		Code:          model.Code,
		Name:          model.Name,
		Description:   model.Description,
		PolicyType:    model.PolicyType,
		ScopeType:     model.ScopeType,
		TargetClient:  model.TargetClient,
		TargetChannel: model.TargetChannel,
		TargetAction:  model.TargetAction,
		Priority:      model.Priority,
		Active:        model.Active,
		ConfigJSON:    model.ConfigJSON,
		CreatedAt:     model.CreatedAt,
		UpdatedAt:     model.UpdatedAt,
	}
}

func securityPolicyToGorm(policy *domain.SecurityPolicy) *GormSecurityPolicy {
	return &GormSecurityPolicy{
		ID:            policy.ID,
		Code:          policy.Code,
		Name:          policy.Name,
		Description:   policy.Description,
		PolicyType:    policy.PolicyType,
		ScopeType:     policy.ScopeType,
		TargetClient:  policy.TargetClient,
		TargetChannel: policy.TargetChannel,
		TargetAction:  policy.TargetAction,
		Priority:      policy.Priority,
		Active:        policy.Active,
		ConfigJSON:    policy.ConfigJSON,
	}
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

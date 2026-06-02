package repository

import (
	"context"
	"time"

	"github.com/owner/auth-server/internal/authorization/permission"
	"github.com/owner/auth-server/internal/authorization/specification"
	"github.com/owner/auth-server/internal/domain"
	"gorm.io/gorm"
)

// ─── Role Repository ──────────────────────────────────────────────────────────

type RoleRepository struct{ db *gorm.DB }

func NewRoleRepository(db *gorm.DB) *RoleRepository { return &RoleRepository{db} }

func (r *RoleRepository) FindByID(ctx context.Context, id uint) (*domain.Role, error) {
	var role domain.Role
	if err := r.db.WithContext(ctx).Where("id = ? AND deleted = false", id).First(&role).Error; err != nil {
		return nil, err
	}
	role.Permissions = r.loadPermissions(ctx, id)
	return &role, nil
}

func (r *RoleRepository) List(ctx context.Context, spec interface{}) ([]*domain.Role, int64, error) {
	q := r.db.WithContext(ctx).Model(&domain.Role{}).Where("deleted = false")
	if s, ok := spec.(specification.Specification); ok {
		sql, args := s.ToSQL()
		q = q.Where(sql, args...)
	}
	var total int64
	q.Count(&total)
	var roles []*domain.Role
	if err := q.Order("id DESC").Find(&roles).Error; err != nil {
		return nil, 0, err
	}
	for _, role := range roles {
		role.Permissions = r.loadPermissions(ctx, role.ID)
	}
	return roles, total, nil
}

func (r *RoleRepository) Save(ctx context.Context, role *domain.Role) error {
	if role.ID == 0 {
		role.CreatedAt = time.Now()
		return r.db.WithContext(ctx).Create(role).Error
	}
	return r.db.WithContext(ctx).Save(role).Error
}

func (r *RoleRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Model(&domain.Role{}).Where("id = ?", id).Update("deleted", true).Error
}

func (r *RoleRepository) GetUserCount(ctx context.Context, roleID uint) int64 {
	var count int64
	r.db.WithContext(ctx).Model(&domain.UserRole{}).Where("role_id = ? AND deleted = false", roleID).Count(&count)
	return count
}

func (r *RoleRepository) AssignPermissions(ctx context.Context, roleID uint, perms []domain.RolePermission) error {
	r.db.WithContext(ctx).Model(&domain.RolePermission{}).Where("role_id = ?", roleID).Update("deleted", true)
	for _, p := range perms {
		var def domain.PermissionDef
		if err := r.db.WithContext(ctx).Where("code = ? AND deleted = false", string(p.Code)).First(&def).Error; err != nil {
			continue
		}
		var existing domain.RolePermission
		r.db.WithContext(ctx).Where("role_id = ? AND permission_id = ?", roleID, def.ID).First(&existing)
		if existing.ID == 0 {
			r.db.WithContext(ctx).Create(&domain.RolePermission{RoleID: roleID, PermissionID: def.ID, Scope: p.Scope})
		} else {
			r.db.WithContext(ctx).Model(&existing).Updates(map[string]interface{}{"deleted": false, "scope": string(p.Scope)})
		}
	}
	return nil
}

func (r *RoleRepository) loadPermissions(ctx context.Context, roleID uint) []*domain.RolePermission {
	type row struct {
		PermID uint
		Code   string
		Scope  string
	}
	var rows []row
	r.db.WithContext(ctx).Raw(`
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

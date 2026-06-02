package repository

import (
	"context"
	"time"

	"github.com/owner/auth-server/internal/authorization/permission"
	"github.com/owner/auth-server/internal/domain"
	"gorm.io/gorm"
)

// ─── Permission Repository ────────────────────────────────────────────────────

type PermissionRepository struct{ db *gorm.DB }

func NewPermissionRepository(db *gorm.DB) *PermissionRepository {
	return &PermissionRepository{db}
}

// SyncFromRegistry ensures every registered permission exists in the DB.
func (r *PermissionRepository) SyncFromRegistry() {
	for _, group := range permission.Registry {
		for _, perm := range group.Permissions {
			var existing domain.PermissionDef
			if r.db.Where("code = ?", string(perm)).First(&existing).Error != nil {
				r.db.Create(&domain.PermissionDef{Code: perm, Name: string(perm), GroupName: group.Name})
			}
		}
	}
	var w domain.PermissionDef
	if r.db.Where("code = ?", "*").First(&w).Error != nil {
		r.db.Create(&domain.PermissionDef{Code: "*", Name: "Wildcard (Super Admin)", GroupName: "system"})
	}
}

func (r *PermissionRepository) FindAll(ctx context.Context) ([]*domain.PermissionDef, error) {
	var defs []*domain.PermissionDef
	if err := r.db.WithContext(ctx).Where("deleted = false").Order("group_name, code").Find(&defs).Error; err != nil {
		return nil, err
	}
	return defs, nil
}

func (r *PermissionRepository) FindByCode(ctx context.Context, code permission.Permission) (*domain.PermissionDef, error) {
	var def domain.PermissionDef
	if err := r.db.WithContext(ctx).Where("code = ? AND deleted = false", string(code)).First(&def).Error; err != nil {
		return nil, err
	}
	return &def, nil
}

func (r *PermissionRepository) FindByUserID(ctx context.Context, userID uint) ([]*domain.RolePermission, error) {
	type row struct{ Code, Scope string }
	var rows []row
	r.db.WithContext(ctx).Raw(`
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

func (r *PermissionRepository) Save(ctx context.Context, p *domain.PermissionDef) error {
	if p.ID == 0 {
		return r.db.WithContext(ctx).Create(p).Error
	}
	return r.db.WithContext(ctx).Save(p).Error
}

func (r *PermissionRepository) AddLine(ctx context.Context, line *domain.PermissionLine) error {
	line.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(line).Error
}

func (r *PermissionRepository) DeleteLine(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Model(&domain.PermissionLine{}).Where("id = ?", id).Update("deleted", true).Error
}

func (r *PermissionRepository) GetLines(ctx context.Context, permID uint) ([]*domain.PermissionLine, error) {
	var lines []*domain.PermissionLine
	if err := r.db.WithContext(ctx).Where("permission_id = ? AND deleted = false", permID).Find(&lines).Error; err != nil {
		return nil, err
	}
	return lines, nil
}

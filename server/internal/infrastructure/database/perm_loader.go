package database

import (
	"github.com/owner/auth-server/internal/authorization/permission"
	"github.com/owner/auth-server/internal/domain"
	"gorm.io/gorm"
)

// PermLoader implements middleware.PermissionLoader using the database.
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

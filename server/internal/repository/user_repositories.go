package repository

import (
	"context"
	"time"

	"github.com/owner/auth-server/internal/authorization/permission"
	"github.com/owner/auth-server/internal/authorization/specification"
	"github.com/owner/auth-server/internal/domain"
	"gorm.io/gorm"
)

// ─── User Repository ──────────────────────────────────────────────────────────

type UserRepository struct{ db *gorm.DB }

func NewUserRepository(db *gorm.DB) *UserRepository { return &UserRepository{db} }

func (r *UserRepository) FindByID(ctx context.Context, id uint) (*domain.User, error) {
	var u domain.User
	if err := r.db.WithContext(ctx).Where("id = ? AND deleted = false", id).First(&u).Error; err != nil {
		return nil, err
	}
	u.Roles = r.loadRoles(ctx, u.ID)
	return &u, nil
}

func (r *UserRepository) FindByUsername(ctx context.Context, username string) (*domain.User, error) {
	var u domain.User
	if err := r.db.WithContext(ctx).Where("username = ? AND deleted = false", username).First(&u).Error; err != nil {
		return nil, err
	}
	u.Roles = r.loadRoles(ctx, u.ID)
	return &u, nil
}

func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
	var u domain.User
	if err := r.db.WithContext(ctx).Where("email = ? AND deleted = false", email).First(&u).Error; err != nil {
		return nil, err
	}
	u.Roles = r.loadRoles(ctx, u.ID)
	return &u, nil
}

func (r *UserRepository) List(ctx context.Context, spec interface{}) ([]*domain.User, int64, error) {
	q := r.db.WithContext(ctx).Model(&domain.User{}).Where("deleted = false")
	if s, ok := spec.(specification.Specification); ok {
		sql, args := s.ToSQL()
		q = q.Where(sql, args...)
	}
	var total int64
	q.Count(&total)
	var users []*domain.User
	if err := q.Order("id DESC").Find(&users).Error; err != nil {
		return nil, 0, err
	}
	for _, u := range users {
		u.Roles = r.loadRoles(ctx, u.ID)
	}
	return users, total, nil
}

func (r *UserRepository) Save(ctx context.Context, u *domain.User) error {
	if u.ID == 0 {
		return r.db.WithContext(ctx).Create(u).Error
	}
	return r.db.WithContext(ctx).Save(u).Error
}

func (r *UserRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Model(&domain.User{}).Where("id = ?", id).Update("deleted", true).Error
}

func (r *UserRepository) SetRoles(ctx context.Context, userID uint, roleIDs []uint) error {
	r.db.WithContext(ctx).Model(&domain.UserRole{}).Where("user_id = ?", userID).Update("deleted", true)
	for _, rid := range roleIDs {
		var ur domain.UserRole
		r.db.WithContext(ctx).Where("user_id = ? AND role_id = ?", userID, rid).First(&ur)
		if ur.ID == 0 {
			r.db.WithContext(ctx).Create(&domain.UserRole{UserID: userID, RoleID: rid, Deleted: false})
		} else {
			r.db.WithContext(ctx).Model(&ur).Update("deleted", false)
		}
	}
	return nil
}

func (r *UserRepository) UpdateLastLogin(ctx context.Context, userID uint) error {
	return r.db.WithContext(ctx).Model(&domain.User{}).Where("id = ?", userID).
		Updates(map[string]interface{}{"last_login": time.Now(), "failed_logins": 0, "locked_until": nil}).Error
}

func (r *UserRepository) UpdateFailedLogin(ctx context.Context, userID uint, count int, lockedUntil *time.Time) error {
	updates := map[string]interface{}{"failed_logins": count}
	if lockedUntil != nil {
		updates["locked_until"] = lockedUntil
		updates["status"] = "locked"
	}
	return r.db.WithContext(ctx).Model(&domain.User{}).Where("id = ?", userID).Updates(updates).Error
}

func (r *UserRepository) loadRoles(ctx context.Context, userID uint) []*domain.Role {
	type row struct {
		RoleID      uint
		Name        string
		Description string
		PermCode    string
		Scope       string
	}
	var rows []row
	r.db.WithContext(ctx).Raw(`
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
			roleMap[row.RoleID] = &domain.Role{ID: row.RoleID, Name: row.Name, Description: row.Description}
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

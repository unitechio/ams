package repository

import (
	"context"

	"github.com/owner/auth-server/internal/authorization/specification"
	"github.com/owner/auth-server/internal/domain"
	"gorm.io/gorm"
)

// ─── Menu Repository ──────────────────────────────────────────────────────────

type MenuRepository struct{ db *gorm.DB }

func NewMenuRepository(db *gorm.DB) *MenuRepository { return &MenuRepository{db} }

func (r *MenuRepository) FindAll(ctx context.Context) ([]*domain.Menu, error) {
	var menus []*domain.Menu
	if err := r.db.WithContext(ctx).Where("deleted = false").Order("sort_order DESC").Find(&menus).Error; err != nil {
		return nil, err
	}
	return menus, nil
}

func (r *MenuRepository) FindByID(ctx context.Context, id uint) (*domain.Menu, error) {
	var m domain.Menu
	if err := r.db.WithContext(ctx).Where("id = ? AND deleted = false", id).First(&m).Error; err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *MenuRepository) Save(ctx context.Context, menu *domain.Menu) error {
	if menu.ID == 0 {
		return r.db.WithContext(ctx).Create(menu).Error
	}
	return r.db.WithContext(ctx).Save(menu).Error
}

func (r *MenuRepository) Delete(ctx context.Context, id uint) error {
	r.db.WithContext(ctx).Model(&domain.Menu{}).Where("parent_id = ?", id).Update("deleted", true)
	return r.db.WithContext(ctx).Model(&domain.Menu{}).Where("id = ?", id).Update("deleted", true).Error
}

func (r *MenuRepository) ListPaginated(ctx context.Context, spec interface{}) ([]*domain.Menu, int64, error) {
	q := r.db.WithContext(ctx).Model(&domain.Menu{}).Where("deleted = false")
	if s, ok := spec.(specification.Specification); ok {
		sql, args := s.ToSQL()
		q = q.Where(sql, args...)
	}
	var total int64
	q.Count(&total)
	var menus []*domain.Menu
	if err := q.Order("sort_order DESC").Find(&menus).Error; err != nil {
		return nil, 0, err
	}
	return menus, total, nil
}

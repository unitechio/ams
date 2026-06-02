package repository

import (
	"context"
	"strings"

	"github.com/owner/auth-server/internal/domain"
	"gorm.io/gorm"
)

// ─── SSO Provider Repository ─────────────────────────────────────────────────

type SSOProviderRepository struct{ db *gorm.DB }

func NewSSOProviderRepository(db *gorm.DB) *SSOProviderRepository {
	return &SSOProviderRepository{db}
}

func (r *SSOProviderRepository) FindByProviderID(ctx context.Context, providerID string) (*domain.SSOProvider, error) {
	var p domain.SSOProvider
	if err := r.db.WithContext(ctx).Where("provider_id = ?", providerID).First(&p).Error; err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *SSOProviderRepository) FindByID(ctx context.Context, id uint) (*domain.SSOProvider, error) {
	var p domain.SSOProvider
	if err := r.db.WithContext(ctx).First(&p, id).Error; err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *SSOProviderRepository) List(ctx context.Context, filters map[string]interface{}) ([]*domain.SSOProvider, int64, error) {
	q := r.db.WithContext(ctx).Model(&domain.SSOProvider{})
	if search, ok := filters["search"].(string); ok && strings.TrimSpace(search) != "" {
		like := "%" + strings.TrimSpace(search) + "%"
		q = q.Where("provider_id ILIKE ? OR name ILIKE ? OR type ILIKE ?", like, like, like)
	}
	if t, ok := filters["type"].(string); ok && strings.TrimSpace(t) != "" {
		q = q.Where("type = ?", strings.TrimSpace(t))
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
	var providers []*domain.SSOProvider
	if err := q.Order("id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&providers).Error; err != nil {
		return nil, 0, err
	}
	return providers, total, nil
}

func (r *SSOProviderRepository) Save(ctx context.Context, provider *domain.SSOProvider) error {
	if provider.ID == 0 {
		return r.db.WithContext(ctx).Create(provider).Error
	}
	return r.db.WithContext(ctx).Save(provider).Error
}

func (r *SSOProviderRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&domain.SSOProvider{}, id).Error
}

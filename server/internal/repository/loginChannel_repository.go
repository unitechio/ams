package repository

import (
	"context"
	"strings"

	"github.com/owner/auth-server/internal/domain"
	"gorm.io/gorm"
)

// ─── Login Channel Repository ─────────────────────────────────────────────────

type LoginChannelRepository struct{ db *gorm.DB }

func NewLoginChannelRepository(db *gorm.DB) *LoginChannelRepository {
	return &LoginChannelRepository{db}
}

func (r *LoginChannelRepository) FindByCode(ctx context.Context, code string) (*domain.LoginChannel, error) {
	var ch domain.LoginChannel
	if err := r.db.WithContext(ctx).Where("code = ?", code).First(&ch).Error; err != nil {
		return nil, err
	}
	return &ch, nil
}

func (r *LoginChannelRepository) List(ctx context.Context, filters map[string]interface{}) ([]*domain.LoginChannel, int64, error) {
	q := r.db.WithContext(ctx).Model(&domain.LoginChannel{})
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
	var channels []*domain.LoginChannel
	if err := q.Order("id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&channels).Error; err != nil {
		return nil, 0, err
	}
	return channels, total, nil
}

func (r *LoginChannelRepository) Save(ctx context.Context, channel *domain.LoginChannel) error {
	if channel.ID == 0 {
		return r.db.WithContext(ctx).Create(channel).Error
	}
	return r.db.WithContext(ctx).Save(channel).Error
}

func (r *LoginChannelRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&domain.LoginChannel{}, id).Error
}

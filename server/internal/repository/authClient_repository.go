package repository

import (
	"context"
	"strings"

	"github.com/owner/auth-server/internal/domain"
	"gorm.io/gorm"
)

// ─── Auth Client Repository ───────────────────────────────────────────────────

type ClientRepository struct{ db *gorm.DB }

func NewClientRepository(db *gorm.DB) *ClientRepository { return &ClientRepository{db} }

func (r *ClientRepository) FindByClientID(ctx context.Context, clientID string) (*domain.AuthClient, error) {
	var c domain.AuthClient
	if err := r.db.WithContext(ctx).Where("client_id = ?", clientID).First(&c).Error; err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *ClientRepository) List(ctx context.Context, filters map[string]interface{}) ([]*domain.AuthClient, int64, error) {
	q := r.db.WithContext(ctx).Model(&domain.AuthClient{})
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
	var clients []*domain.AuthClient
	if err := q.Order("id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&clients).Error; err != nil {
		return nil, 0, err
	}
	return clients, total, nil
}

func (r *ClientRepository) Save(ctx context.Context, client *domain.AuthClient) error {
	if client.ID == 0 {
		return r.db.WithContext(ctx).Create(client).Error
	}
	return r.db.WithContext(ctx).Save(client).Error
}

func (r *ClientRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&domain.AuthClient{}, id).Error
}

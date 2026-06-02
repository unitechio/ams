package repository

import (
	"context"
	"strings"
	"time"

	"github.com/owner/auth-server/internal/domain"
	"gorm.io/gorm"
)

// ─── Security Policy Repository ───────────────────────────────────────────────

type SecurityPolicyRepository struct{ db *gorm.DB }

func NewSecurityPolicyRepository(db *gorm.DB) *SecurityPolicyRepository {
	return &SecurityPolicyRepository{db}
}

func (r *SecurityPolicyRepository) List(ctx context.Context, filters map[string]interface{}) ([]*domain.SecurityPolicy, int64, error) {
	q := r.db.WithContext(ctx).Model(&domain.SecurityPolicy{})
	if search, ok := filters["search"].(string); ok && strings.TrimSpace(search) != "" {
		like := "%" + strings.TrimSpace(search) + "%"
		q = q.Where("code ILIKE ? OR name ILIKE ? OR policy_type ILIKE ? OR scope_type ILIKE ? OR target_client ILIKE ? OR target_channel ILIKE ? OR target_action ILIKE ?",
			like, like, like, like, like, like, like)
	}
	if v, ok := filters["target_action"].(string); ok && strings.TrimSpace(v) != "" {
		q = q.Where("target_action = ?", strings.TrimSpace(v))
	}
	if v, ok := filters["policy_type"].(string); ok && strings.TrimSpace(v) != "" {
		q = q.Where("policy_type = ?", strings.TrimSpace(v))
	}
	if v, ok := filters["scope_type"].(string); ok && strings.TrimSpace(v) != "" {
		q = q.Where("scope_type = ?", strings.TrimSpace(v))
	}
	if v, ok := filters["active"].(string); ok && strings.TrimSpace(v) != "" {
		q = q.Where("active = ?", strings.EqualFold(strings.TrimSpace(v), "true"))
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
	var policies []*domain.SecurityPolicy
	if err := q.Order("priority ASC, id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&policies).Error; err != nil {
		return nil, 0, err
	}
	return policies, total, nil
}

func (r *SecurityPolicyRepository) Save(ctx context.Context, policy *domain.SecurityPolicy) error {
	if policy.ID == 0 {
		return r.db.WithContext(ctx).Create(policy).Error
	}
	return r.db.WithContext(ctx).Save(policy).Error
}

func (r *SecurityPolicyRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&domain.SecurityPolicy{}, id).Error
}

// ─── Reference Option Repository ─────────────────────────────────────────────

type ReferenceOptionRepository struct{ db *gorm.DB }

func NewReferenceOptionRepository(db *gorm.DB) *ReferenceOptionRepository {
	return &ReferenceOptionRepository{db}
}

func (r *ReferenceOptionRepository) FindByID(ctx context.Context, id uint) (*domain.ReferenceOption, error) {
	var opt domain.ReferenceOption
	if err := r.db.WithContext(ctx).First(&opt, id).Error; err != nil {
		return nil, err
	}
	return &opt, nil
}

func (r *ReferenceOptionRepository) List(ctx context.Context, filters map[string]interface{}) ([]*domain.ReferenceOption, int64, error) {
	q := r.db.WithContext(ctx).Model(&domain.ReferenceOption{})
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
	var opts []*domain.ReferenceOption
	if err := q.Order("option_group ASC, sort_order ASC, id ASC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&opts).Error; err != nil {
		return nil, 0, err
	}
	return opts, total, nil
}

func (r *ReferenceOptionRepository) Save(ctx context.Context, item *domain.ReferenceOption) error {
	if item.ID == 0 {
		return r.db.WithContext(ctx).Create(item).Error
	}
	return r.db.WithContext(ctx).Save(item).Error
}

func (r *ReferenceOptionRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&domain.ReferenceOption{}, id).Error
}

// ─── Audit Log Repository ─────────────────────────────────────────────────────

type AuditLogRepository struct{ db *gorm.DB }

func NewAuditLogRepository(db *gorm.DB) *AuditLogRepository { return &AuditLogRepository{db} }

func (r *AuditLogRepository) Save(ctx context.Context, log *domain.AuditLog) error {
	log.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(log).Error
}

func (r *AuditLogRepository) List(ctx context.Context, spec interface{}) ([]*domain.AuditLog, int64, error) {
	q := r.db.WithContext(ctx).Model(&domain.AuditLog{})
	if s, ok := spec.(map[string]interface{}); ok {
		if v, ok := s["search"].(string); ok && v != "" {
			like := "%" + v + "%"
			q = q.Where("(username LIKE ? OR action LIKE ? OR resource LIKE ? OR request LIKE ? OR response LIKE ?)", like, like, like, like, like)
		}
		if v, ok := s["user"].(string); ok && v != "" {
			q = q.Where("username = ?", v)
		}
		if v, ok := s["action"].(string); ok && v != "" {
			q = q.Where("action = ?", v)
		}
		if v, ok := s["from"].(string); ok && v != "" {
			q = q.Where("created_at >= ?", v)
		}
		if v, ok := s["to"].(string); ok && v != "" {
			q = q.Where("created_at <= ?", v)
		}
	}
	var total int64
	q.Count(&total)
	q = q.Order("created_at DESC")
	if s, ok := spec.(map[string]interface{}); ok {
		page, pageSize := 1, 10
		if p, ok := s["page"].(int); ok && p > 0 {
			page = p
		}
		if ps, ok := s["page_size"].(int); ok && ps > 0 {
			pageSize = ps
		}
		q = q.Offset((page - 1) * pageSize).Limit(pageSize)
	}
	var logs []*domain.AuditLog
	if err := q.Find(&logs).Error; err != nil {
		return nil, 0, err
	}
	return logs, total, nil
}

// ─── Auth History Repository ──────────────────────────────────────────────────

type AuthHistoryRepository struct{ db *gorm.DB }

func NewAuthHistoryRepository(db *gorm.DB) *AuthHistoryRepository {
	return &AuthHistoryRepository{db}
}

func (r *AuthHistoryRepository) Save(ctx context.Context, h *domain.AuthHistory) error {
	h.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(h).Error
}

func (r *AuthHistoryRepository) List(ctx context.Context, spec interface{}) ([]*domain.AuthHistory, int64, error) {
	q := r.db.WithContext(ctx).Model(&domain.AuthHistory{})
	if s, ok := spec.(map[string]interface{}); ok {
		if v, ok := s["search"].(string); ok && v != "" {
			like := "%" + v + "%"
			q = q.Where("username LIKE ? OR ip_address LIKE ? OR note LIKE ?", like, like, like)
		}
	}
	var total int64
	q.Count(&total)
	q = q.Order("created_at DESC")
	if s, ok := spec.(map[string]interface{}); ok {
		page, pageSize := 1, 10
		if p, ok := s["page"].(int); ok && p > 0 {
			page = p
		}
		if ps, ok := s["page_size"].(int); ok && ps > 0 {
			pageSize = ps
		}
		q = q.Offset((page - 1) * pageSize).Limit(pageSize)
	}
	var histories []*domain.AuthHistory
	if err := q.Find(&histories).Error; err != nil {
		return nil, 0, err
	}
	return histories, total, nil
}

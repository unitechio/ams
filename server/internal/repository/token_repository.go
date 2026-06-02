package repository

import (
	"context"
	"strings"
	"time"

	"github.com/owner/auth-server/internal/domain"
	"gorm.io/gorm"
)

// ─── Refresh Token Repository ─────────────────────────────────────────────────

type TokenRepository struct{ db *gorm.DB }

func NewTokenRepository(db *gorm.DB) *TokenRepository { return &TokenRepository{db} }

func (r *TokenRepository) Save(ctx context.Context, t *domain.RefreshToken) error {
	return r.db.WithContext(ctx).Create(t).Error
}

func (r *TokenRepository) FindByToken(ctx context.Context, token string) (*domain.RefreshToken, error) {
	var t domain.RefreshToken
	if err := r.db.WithContext(ctx).Where("token = ? AND revoked = false", token).First(&t).Error; err != nil {
		if err2 := r.db.WithContext(ctx).Where("token = ?", token).First(&t).Error; err2 != nil {
			return nil, err2
		}
	}
	return &t, nil
}

func (r *TokenRepository) RevokeByUserID(ctx context.Context, userID uint) error {
	return r.db.WithContext(ctx).Model(&domain.RefreshToken{}).Where("user_id = ?", userID).
		Updates(map[string]interface{}{"revoked": true, "revoked_reason": "user_logout_all"}).Error
}

func (r *TokenRepository) RevokeToken(ctx context.Context, token string) error {
	return r.db.WithContext(ctx).Model(&domain.RefreshToken{}).Where("token = ?", token).
		Updates(map[string]interface{}{"revoked": true, "revoked_reason": "token_rotated"}).Error
}

func (r *TokenRepository) RevokeSession(ctx context.Context, userID uint, sessionID string) error {
	return r.db.WithContext(ctx).Model(&domain.RefreshToken{}).
		Where("user_id = ? AND session_id = ?", userID, sessionID).
		Updates(map[string]interface{}{"revoked": true, "revoked_reason": "session_revoked"}).Error
}

func (r *TokenRepository) RevokeSessionByID(ctx context.Context, sessionID string) error {
	return r.db.WithContext(ctx).Model(&domain.RefreshToken{}).
		Where("session_id = ?", sessionID).
		Updates(map[string]interface{}{"revoked": true, "revoked_reason": "admin_session_revoked"}).Error
}

func (r *TokenRepository) RevokeFamily(ctx context.Context, familyID string, reason string) error {
	return r.db.WithContext(ctx).Model(&domain.RefreshToken{}).
		Where("token_family = ?", familyID).
		Updates(map[string]interface{}{"revoked": true, "revoked_reason": reason}).Error
}

func (r *TokenRepository) ListActiveSessions(ctx context.Context, userID uint) ([]*domain.RefreshToken, error) {
	var tokens []*domain.RefreshToken
	if err := r.db.WithContext(ctx).
		Where("user_id = ? AND revoked = false AND expires_at > ?", userID, time.Now()).
		Order("last_used_at DESC, created_at DESC").
		Find(&tokens).Error; err != nil {
		return nil, err
	}
	result := make([]*domain.RefreshToken, 0, len(tokens))
	seen := map[string]bool{}
	for _, t := range tokens {
		if t.SessionID == "" || seen[t.SessionID] {
			continue
		}
		seen[t.SessionID] = true
		result = append(result, t)
	}
	return result, nil
}

func (r *TokenRepository) ListSessions(ctx context.Context, filters map[string]interface{}) ([]*domain.RefreshToken, int64, error) {
	type row struct {
		domain.RefreshToken
		UName string
		Email string
	}
	q := r.db.WithContext(ctx).Table("sys_refresh_tokens rt").
		Select("rt.*, u.username as u_name, u.email").
		Joins("JOIN sys_users u ON u.id = rt.user_id").
		Where("rt.revoked = false AND rt.expires_at > ? AND u.deleted = false", time.Now())

	if search, ok := filters["search"].(string); ok && strings.TrimSpace(search) != "" {
		like := "%" + strings.TrimSpace(search) + "%"
		q = q.Where("(u.username ILIKE ? OR u.email ILIKE ? OR rt.device_name ILIKE ? OR rt.client_id ILIKE ? OR rt.ip_address ILIKE ?)", like, like, like, like, like)
	}
	if clientID, ok := filters["client_id"].(string); ok && strings.TrimSpace(clientID) != "" {
		q = q.Where("rt.client_id = ?", strings.TrimSpace(clientID))
	}
	if trusted, ok := filters["trusted"].(string); ok && strings.TrimSpace(trusted) != "" {
		q = q.Where("rt.trusted = ?", strings.EqualFold(trusted, "true"))
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

	var rows []row
	if err := q.Order("rt.last_used_at DESC, rt.created_at DESC").
		Offset((page - 1) * pageSize).Limit(pageSize).Find(&rows).Error; err != nil {
		return nil, 0, err
	}

	result := make([]*domain.RefreshToken, 0, len(rows))
	seen := map[string]bool{}
	for _, item := range rows {
		if item.SessionID == "" || seen[item.SessionID] {
			continue
		}
		seen[item.SessionID] = true
		t := item.RefreshToken
		t.Username = item.UName
		t.UserEmail = item.Email
		result = append(result, &t)
	}
	return result, total, nil
}

func (r *TokenRepository) FindTrustedDevice(ctx context.Context, userID uint, clientID, fingerprint string) (*domain.RefreshToken, error) {
	var t domain.RefreshToken
	if err := r.db.WithContext(ctx).
		Where("user_id = ? AND client_id = ? AND device_fingerprint = ? AND trusted = true AND revoked = false AND expires_at > ?",
			userID, clientID, fingerprint, time.Now()).
		Order("last_used_at DESC, created_at DESC").
		First(&t).Error; err != nil {
		return nil, err
	}
	return &t, nil
}

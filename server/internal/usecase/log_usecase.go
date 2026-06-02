package usecase

import (
	"context"
	"time"

	"github.com/owner/auth-server/internal/domain"
)

type AuditLogResponse struct {
	ID         uint      `json:"id"`
	UserID     uint      `json:"user_id"`
	Username   string    `json:"username"`
	Action     string    `json:"action"`
	Resource   string    `json:"resource"`
	ResourceID string    `json:"resource_id"`
	IPAddress  string    `json:"ip_address"`
	UserAgent  string    `json:"user_agent"`
	Request    string    `json:"request"`
	Response   string    `json:"response"`
	Allowed    bool      `json:"allowed"`
	CreatedAt  time.Time `json:"created_at"`
}

type AuthHistoryResponse struct {
	ID        uint      `json:"id"`
	UserID    uint      `json:"user_id"`
	Username  string    `json:"username"`
	IPAddress string    `json:"ip_address"`
	UserAgent string    `json:"user_agent"`
	Status    string    `json:"status"`
	Note      string    `json:"note"`
	CreatedAt time.Time `json:"created_at"`
}

type LogUsecase struct {
	auditRepo domain.AuditLogRepository
	authRepo  domain.AuthHistoryRepository
}

func NewLogUsecase(auditRepo domain.AuditLogRepository, authRepo domain.AuthHistoryRepository) *LogUsecase {
	return &LogUsecase{auditRepo, authRepo}
}

func (uc *LogUsecase) ListAuditLogs(spec interface{}) (*PaginatedResult[AuditLogResponse], error) {
	logs, total, err := uc.auditRepo.List(context.Background(), spec)
	if err != nil {
		return nil, err
	}
	res := make([]AuditLogResponse, len(logs))
	for i, l := range logs {
		res[i] = AuditLogResponse{
			ID: l.ID, UserID: l.UserID, Username: l.Username, Action: l.Action,
			Resource: l.Resource, ResourceID: l.ResourceID, IPAddress: l.IPAddress,
			UserAgent: l.UserAgent, Request: l.Request, Response: l.Response,
			Allowed: l.Allowed, CreatedAt: l.CreatedAt,
		}
	}

	page, pageSize := 1, 10
	if s, ok := spec.(map[string]interface{}); ok {
		if v, exists := s["page"]; exists {
			page = v.(int)
		}
		if v, exists := s["page_size"]; exists {
			pageSize = v.(int)
		}
	}

	return paginate(res, total, page, pageSize), nil
}

func (uc *LogUsecase) ListAuthHistory(spec interface{}) (*PaginatedResult[AuthHistoryResponse], error) {
	histories, total, err := uc.authRepo.List(context.Background(), spec)
	if err != nil {
		return nil, err
	}
	res := make([]AuthHistoryResponse, len(histories))
	for i, h := range histories {
		res[i] = AuthHistoryResponse{
			ID: h.ID, UserID: h.UserID, Username: h.Username, IPAddress: h.IPAddress,
			UserAgent: h.UserAgent, Status: h.Status, Note: h.Note, CreatedAt: h.CreatedAt,
		}
	}

	page, pageSize := 1, 10
	if s, ok := spec.(map[string]interface{}); ok {
		if v, exists := s["page"]; exists {
			page = v.(int)
		}
		if v, exists := s["page_size"]; exists {
			pageSize = v.(int)
		}
	}

	return paginate(res, total, page, pageSize), nil
}

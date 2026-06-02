package usecase

import (
	"context"
	"errors"
	"fmt"

	"github.com/owner/auth-server/internal/authorization/permission"
	"github.com/owner/auth-server/internal/domain"
)

// ─── Permission Usecase ───────────────────────────────────────────────────────

type PermissionResponse struct {
	ID          uint                     `json:"id"`
	Code        string                   `json:"code"`
	Name        string                   `json:"name"`
	Description string                   `json:"description"`
	GroupName   string                   `json:"group_name"`
	Lines       []*domain.PermissionLine `json:"lines"`
}

type CreatePermissionReq struct {
	Code        string `json:"code" binding:"required"`
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	GroupName   string `json:"group_name" binding:"required"`
}

type PermissionUsecase struct{ repo domain.PermissionRepository }

func NewPermissionUsecase(repo domain.PermissionRepository) *PermissionUsecase {
	return &PermissionUsecase{repo}
}

func (uc *PermissionUsecase) ListAll() ([]PermissionResponse, error) {
	defs, err := uc.repo.FindAll(context.Background())
	if err != nil {
		return nil, err
	}
	result := make([]PermissionResponse, len(defs))
	for i, d := range defs {
		lines, _ := uc.repo.GetLines(context.Background(), d.ID)
		result[i] = PermissionResponse{
			ID:          d.ID,
			Code:        string(d.Code),
			Name:        d.Name,
			Description: d.Description,
			GroupName:   d.GroupName,
			Lines:       lines,
		}
	}
	return result, nil
}

func (uc *PermissionUsecase) Create(req *CreatePermissionReq) (*PermissionResponse, error) {
	// Check if already exists
	existing, _ := uc.repo.FindByCode(context.Background(), permission.Permission(req.Code))
	if existing != nil {
		return nil, fmt.Errorf("quyền '%s' đã tồn tại", req.Code)
	}

	p := &domain.PermissionDef{
		Code:        permission.Permission(req.Code),
		Name:        req.Name,
		Description: req.Description,
		GroupName:   req.GroupName,
	}
	if err := uc.repo.Save(context.Background(), p); err != nil {
		return nil, err
	}
	return &PermissionResponse{
		ID:          p.ID,
		Code:        string(p.Code),
		Name:        p.Name,
		Description: p.Description,
		GroupName:   p.GroupName,
		Lines:       []*domain.PermissionLine{},
	}, nil
}

func (uc *PermissionUsecase) AddLine(permCode string, line *domain.PermissionLine, by string) (*domain.PermissionLine, error) {
	def, err := uc.repo.FindByCode(context.Background(), permission.Permission(permCode))
	if err != nil {
		return nil, errors.New("quyền hạn không tồn tại")
	}
	line.PermissionID = def.ID
	line.CreatedBy = by
	if err = uc.repo.AddLine(context.Background(), line); err != nil {
		return nil, err
	}
	return line, nil
}

func (uc *PermissionUsecase) DeleteLine(id uint) error { return uc.repo.DeleteLine(context.Background(), id) }

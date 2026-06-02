package usecase

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/owner/auth-server/internal/domain"
)

type CreateReferenceOptionReq struct {
	OptionGroup string `json:"option_group" binding:"required"`
	Value       string `json:"value" binding:"required"`
	Label       string `json:"label" binding:"required"`
	Description string `json:"description"`
	MetaJSON    string `json:"meta_json"`
	SortOrder   int    `json:"sort_order"`
	Active      bool   `json:"active"`
}

type UpdateReferenceOptionReq = CreateReferenceOptionReq

type ReferenceOptionResponse struct {
	ID          uint      `json:"id"`
	OptionGroup string    `json:"option_group"`
	Value       string    `json:"value"`
	Label       string    `json:"label"`
	Description string    `json:"description"`
	MetaJSON    string    `json:"meta_json"`
	SortOrder   int       `json:"sort_order"`
	Active      bool      `json:"active"`
	CreatedAt   time.Time `json:"created_at"`
}

type ReferenceOptionUsecase struct {
	repo domain.ReferenceOptionRepository
}

func NewReferenceOptionUsecase(repo domain.ReferenceOptionRepository) *ReferenceOptionUsecase {
	return &ReferenceOptionUsecase{repo: repo}
}

func (uc *ReferenceOptionUsecase) List(filters map[string]interface{}, page, pageSize int) (*PaginatedResult[ReferenceOptionResponse], error) {
	filters["page"] = page
	filters["page_size"] = pageSize
	items, total, err := uc.repo.List(context.Background(), filters)
	if err != nil {
		return nil, err
	}
	data := make([]ReferenceOptionResponse, len(items))
	for i, item := range items {
		data[i] = ReferenceOptionResponse{
			ID:          item.ID,
			OptionGroup: item.OptionGroup,
			Value:       item.Value,
			Label:       item.Label,
			Description: item.Description,
			MetaJSON:    item.MetaJSON,
			SortOrder:   item.SortOrder,
			Active:      item.Active,
			CreatedAt:   item.CreatedAt,
		}
	}
	return paginate(data, total, page, pageSize), nil
}

func (uc *ReferenceOptionUsecase) GetByID(id uint) (*ReferenceOptionResponse, error) {
	item, err := uc.repo.FindByID(context.Background(), id)
	if err != nil {
		return nil, errors.New("reference option không tồn tại")
	}
	resp := ReferenceOptionResponse{
		ID:          item.ID,
		OptionGroup: item.OptionGroup,
		Value:       item.Value,
		Label:       item.Label,
		Description: item.Description,
		MetaJSON:    item.MetaJSON,
		SortOrder:   item.SortOrder,
		Active:      item.Active,
		CreatedAt:   item.CreatedAt,
	}
	return &resp, nil
}

func (uc *ReferenceOptionUsecase) Create(req *CreateReferenceOptionReq) (*ReferenceOptionResponse, error) {
	item := &domain.ReferenceOption{
		OptionGroup: strings.TrimSpace(req.OptionGroup),
		Value:       strings.TrimSpace(req.Value),
		Label:       strings.TrimSpace(req.Label),
		Description: strings.TrimSpace(req.Description),
		MetaJSON:    strings.TrimSpace(req.MetaJSON),
		SortOrder:   req.SortOrder,
		Active:      req.Active,
	}
	normalizeReferenceOption(item)
	if err := validateReferenceOption(item); err != nil {
		return nil, err
	}
	if err := uc.repo.Save(context.Background(), item); err != nil {
		return nil, err
	}
	resp := ReferenceOptionResponse{
		ID:          item.ID,
		OptionGroup: item.OptionGroup,
		Value:       item.Value,
		Label:       item.Label,
		Description: item.Description,
		MetaJSON:    item.MetaJSON,
		SortOrder:   item.SortOrder,
		Active:      item.Active,
		CreatedAt:   item.CreatedAt,
	}
	return &resp, nil
}

func (uc *ReferenceOptionUsecase) Update(id uint, req *UpdateReferenceOptionReq) (*ReferenceOptionResponse, error) {
	item, err := uc.findByID(id)
	if err != nil {
		return nil, err
	}
	item.OptionGroup = strings.TrimSpace(req.OptionGroup)
	item.Value = strings.TrimSpace(req.Value)
	item.Label = strings.TrimSpace(req.Label)
	item.Description = strings.TrimSpace(req.Description)
	item.MetaJSON = strings.TrimSpace(req.MetaJSON)
	item.SortOrder = req.SortOrder
	item.Active = req.Active
	normalizeReferenceOption(item)
	if err := validateReferenceOption(item); err != nil {
		return nil, err
	}
	if err := uc.repo.Save(context.Background(), item); err != nil {
		return nil, err
	}
	resp := ReferenceOptionResponse{
		ID:          item.ID,
		OptionGroup: item.OptionGroup,
		Value:       item.Value,
		Label:       item.Label,
		Description: item.Description,
		MetaJSON:    item.MetaJSON,
		SortOrder:   item.SortOrder,
		Active:      item.Active,
		CreatedAt:   item.CreatedAt,
	}
	return &resp, nil
}

func (uc *ReferenceOptionUsecase) Delete(id uint) error {
	return uc.repo.Delete(context.Background(), id)
}

func (uc *ReferenceOptionUsecase) findByID(id uint) (*domain.ReferenceOption, error) {
	items, _, err := uc.repo.List(context.Background(), map[string]interface{}{"page": 1, "page_size": 1000})
	if err != nil {
		return nil, err
	}
	for _, item := range items {
		if item.ID == id {
			return item, nil
		}
	}
	return nil, errors.New("reference option không tồn tại")
}

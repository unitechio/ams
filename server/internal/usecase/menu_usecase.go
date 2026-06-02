package usecase

import (
	"context"
	"errors"

	"github.com/owner/auth-server/internal/authorization/permission"
	"github.com/owner/auth-server/internal/domain"
)

// ─── Menu Usecase ─────────────────────────────────────────────────────────────

type CreateMenuReq struct {
	Title          string `json:"title" binding:"required"`
	URL            string `json:"url"`
	SortOrder      int    `json:"sort_order"`
	Icon           string `json:"icon"`
	PermissionCode string `json:"permission_code"`
	ParentID       *uint  `json:"parent_id"`
	MenuType       string `json:"menu_type"`
}

type MenuResponse struct {
	ID             uint           `json:"id"`
	Title          string         `json:"title"`
	URL            string         `json:"url"`
	SortOrder      int            `json:"sort_order"`
	Icon           string         `json:"icon"`
	PermissionCode string         `json:"permission_code"`
	ParentID       *uint          `json:"parent_id"`
	MenuType       string         `json:"menu_type"`
	Level          int            `json:"level"`
	Children       []MenuResponse `json:"children,omitempty"`
}

type MenuUsecase struct{ repo domain.MenuRepository }

func NewMenuUsecase(repo domain.MenuRepository) *MenuUsecase { return &MenuUsecase{repo} }

func (uc *MenuUsecase) ListPaginated(spec interface{}, page, pageSize int) (*PaginatedResult[MenuResponse], error) {
	menus, total, err := uc.repo.ListPaginated(context.Background(), spec)
	if err != nil {
		return nil, err
	}
	data := make([]MenuResponse, len(menus))
	for i, m := range menus {
		data[i] = menuToResponse(m)
	}
	return paginate(data, total, page, pageSize), nil
}

func (uc *MenuUsecase) GetFiltered(ps *permission.PermissionSet) ([]MenuResponse, error) {
	all, err := uc.repo.FindAll(context.Background())
	if err != nil {
		return nil, err
	}
	// Filter by permissions using menubuilder
	allowed := filterMenuByPermission(all, ps)
	result := make([]MenuResponse, len(allowed))
	for i, m := range allowed {
		result[i] = menuToResponse(m)
	}
	return result, nil
}

func (uc *MenuUsecase) Create(req *CreateMenuReq) (*MenuResponse, error) {
	menuType := req.MenuType
	if menuType == "" {
		menuType = "main"
	}
	m := &domain.Menu{
		Title:          req.Title,
		URL:            req.URL,
		SortOrder:      req.SortOrder,
		Icon:           req.Icon,
		PermissionCode: permission.Permission(req.PermissionCode),
		ParentID:       req.ParentID,
		MenuType:       menuType,
	}
	if err := uc.repo.Save(context.Background(), m); err != nil {
		return nil, err
	}
	r := menuToResponse(m)
	return &r, nil
}

func (uc *MenuUsecase) Update(id uint, req *CreateMenuReq) (*MenuResponse, error) {
	m, err := uc.repo.FindByID(context.Background(), id)
	if err != nil {
		return nil, errors.New("menu không tồn tại")
	}
	if req.Title != "" {
		m.Title = req.Title
	}
	m.URL = req.URL
	m.SortOrder = req.SortOrder
	m.Icon = req.Icon
	m.PermissionCode = permission.Permission(req.PermissionCode)
	m.ParentID = req.ParentID
	if err = uc.repo.Save(context.Background(), m); err != nil {
		return nil, err
	}
	r := menuToResponse(m)
	return &r, nil
}

func (uc *MenuUsecase) Delete(id uint) error { return uc.repo.Delete(context.Background(), id) }
func menuToResponse(m *domain.Menu) MenuResponse {
	level := 1
	if m.ParentID != nil {
		level = 2
	}
	return MenuResponse{
		ID: m.ID, Title: m.Title, URL: m.URL, SortOrder: m.SortOrder,
		Icon: m.Icon, PermissionCode: string(m.PermissionCode),
		ParentID: m.ParentID, MenuType: m.MenuType, Level: level,
	}
}

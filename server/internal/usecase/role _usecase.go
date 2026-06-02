package usecase

import (
	"context"
	"errors"
	"time"

	"github.com/owner/auth-server/internal/authorization/permission"
	"github.com/owner/auth-server/internal/domain"
)

// ─── Role Usecase ─────────────────────────────────────────────────────────────

type CreateRoleReq struct {
	Name        string `json:"name" binding:"required,min=2"`
	Description string `json:"description"`
}

type UpdateRoleReq struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type AssignPermReq struct {
	Permissions []struct {
		Code  string `json:"code"`
		Scope string `json:"scope"`
	} `json:"permissions" binding:"required"`
}

type RoleResponse struct {
	ID              uint     `json:"id"`
	Name            string   `json:"name"`
	Description     string   `json:"description"`
	UserCount       int64    `json:"user_count"`
	PermissionCodes []string `json:"permission_codes"`
	Scopes          []string `json:"scopes"`
}

type RoleUsecase struct{ repo domain.RoleRepository }

func NewRoleUsecase(repo domain.RoleRepository) *RoleUsecase { return &RoleUsecase{repo} }

func (uc *RoleUsecase) List(spec interface{}, page, pageSize int) (*PaginatedResult[RoleResponse], error) {
	roles, total, err := uc.repo.List(context.Background(), spec)
	if err != nil {
		return nil, err
	}
	data := make([]RoleResponse, len(roles))
	for i, r := range roles {
		data[i] = roleToResponse(r, uc.repo.GetUserCount(context.Background(), r.ID))
	}
	return paginate(data, total, page, pageSize), nil
}

func (uc *RoleUsecase) GetByID(id uint) (*RoleResponse, error) {
	r, err := uc.repo.FindByID(context.Background(), id)
	if err != nil {
		return nil, errors.New("vai trò không tồn tại")
	}
	resp := roleToResponse(r, uc.repo.GetUserCount(context.Background(), r.ID))
	return &resp, nil
}

func (uc *RoleUsecase) Create(req *CreateRoleReq, by string) (*RoleResponse, error) {
	role := &domain.Role{Name: req.Name, Description: req.Description, CreatedBy: by, CreatedAt: time.Now()}
	if err := uc.repo.Save(context.Background(), role); err != nil {
		return nil, err
	}
	resp := roleToResponse(role, 0)
	return &resp, nil
}

func (uc *RoleUsecase) Update(id uint, req *UpdateRoleReq) (*RoleResponse, error) {
	role, err := uc.repo.FindByID(context.Background(), id)
	if err != nil {
		return nil, errors.New("vai trò không tồn tại")
	}
	if req.Name != "" {
		role.Name = req.Name
	}
	if req.Description != "" {
		role.Description = req.Description
	}
	if err = uc.repo.Save(context.Background(), role); err != nil {
		return nil, err
	}
	resp := roleToResponse(role, uc.repo.GetUserCount(context.Background(), id))
	return &resp, nil
}

func (uc *RoleUsecase) Delete(id uint) error { return uc.repo.Delete(context.Background(), id) }

func (uc *RoleUsecase) AssignPermissions(id uint, req *AssignPermReq) error {
	perms := make([]domain.RolePermission, len(req.Permissions))
	for i, p := range req.Permissions {
		scope := permission.Scope(p.Scope)
		if scope == "" {
			scope = permission.ScopeSelf
		}
		perms[i] = domain.RolePermission{Code: permission.Permission(p.Code), Scope: scope}
	}
	return uc.repo.AssignPermissions(context.Background(), id, perms)
}

func roleToResponse(r *domain.Role, userCount int64) RoleResponse {
	codes := make([]string, 0, len(r.Permissions))
	scopes := make([]string, 0, len(r.Permissions))
	for _, p := range r.Permissions {
		codes = append(codes, string(p.Code))
		scopes = append(scopes, string(p.Scope))
	}
	return RoleResponse{
		ID: r.ID, Name: r.Name, Description: r.Description,
		UserCount: userCount, PermissionCodes: codes, Scopes: scopes,
	}
}

func roleNames(u *domain.User) []string {
	names := make([]string, 0, len(u.Roles))
	seen := map[string]bool{}
	for _, r := range u.Roles {
		if !seen[r.Name] {
			names = append(names, r.Name)
			seen[r.Name] = true
		}
	}
	return names
}

package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/owner/auth-server/internal/authorization/specification"
	"github.com/owner/auth-server/internal/http/middleware"
	"github.com/owner/auth-server/internal/usecase"
)

// ─── Role Handler ─────────────────────────────────────────────────────────────

type RoleHandler struct{ uc *usecase.RoleUsecase }

func NewRoleHandler(uc *usecase.RoleUsecase) *RoleHandler { return &RoleHandler{uc} }

func (h *RoleHandler) List(c *gin.Context) {
	search := c.Query("search")
	page, pageSize := pagingParams(c)
	spec := specification.NewBuilder().
		And(specification.NotDeleted()).
		AndIf(search != "", specification.SearchSpec(search, "name", "description")).
		Build()
	result, err := h.uc.List(spec, page, pageSize)
	if err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, result)
}

func (h *RoleHandler) Get(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	r, err := h.uc.GetByID(id)
	if err != nil {
		fail(c, http.StatusNotFound, err.Error())
		return
	}
	ok(c, r)
}

func (h *RoleHandler) Create(c *gin.Context) {
	var req usecase.CreateRoleReq
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	r, err := h.uc.Create(&req, middleware.GetUsername(c))
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	created(c, r)
}

func (h *RoleHandler) Update(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	var req usecase.UpdateRoleReq
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	r, err := h.uc.Update(id, &req)
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	ok(c, r)
}

func (h *RoleHandler) Delete(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	if err := h.uc.Delete(id); err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, gin.H{"message": "Đã xóa vai trò"})
}

func (h *RoleHandler) AssignPermissions(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	var req usecase.AssignPermReq
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.uc.AssignPermissions(id, &req); err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, gin.H{"message": "Gán quyền thành công"})
}

// ─── Permission Handler ───────────────────────────────────────────────────────

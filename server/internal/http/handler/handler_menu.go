package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/owner/auth-server/internal/authorization/permission"
	"github.com/owner/auth-server/internal/authorization/specification"
	"github.com/owner/auth-server/internal/usecase"
)

// ─── Menu Handler ─────────────────────────────────────────────────────────────

type MenuHandler struct{ uc *usecase.MenuUsecase }

func NewMenuHandler(uc *usecase.MenuUsecase) *MenuHandler { return &MenuHandler{uc} }

func (h *MenuHandler) List(c *gin.Context) {
	search := c.Query("search")
	page, pageSize := pagingParams(c)
	spec := specification.NewBuilder().
		And(specification.NotDeleted()).
		AndIf(search != "", specification.SearchSpec(search, "title", "url")).
		Build()
	result, err := h.uc.ListPaginated(spec, page, pageSize)
	if err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, result)
}

// MyMenus returns permission-filtered menu tree for the current user.
// This is the endpoint the FE sidebar calls to build navigation.
func (h *MenuHandler) MyMenus(c *gin.Context) {
	val, exists := c.Get("permissionSet")
	if !exists {
		ok(c, []interface{}{})
		return
	}
	permSet, _ := val.(*permission.PermissionSet)
	menus, err := h.uc.GetFiltered(permSet)
	if err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, menus)
}

func (h *MenuHandler) Create(c *gin.Context) {
	var req usecase.CreateMenuReq
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	m, err := h.uc.Create(&req)
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	created(c, m)
}

func (h *MenuHandler) Update(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	var req usecase.CreateMenuReq
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	m, err := h.uc.Update(id, &req)
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	ok(c, m)
}

func (h *MenuHandler) Delete(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	if err := h.uc.Delete(id); err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, gin.H{"message": "Đã xóa menu"})
}

// ─── Log Handler ──────────────────────────────────────────────────────────────

func NewLogHandler(uc *usecase.LogUsecase) *LogHandler {
	return &LogHandler{uc}
}

package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/owner/auth-server/internal/authorization/specification"
	"github.com/owner/auth-server/internal/http/middleware"
	"github.com/owner/auth-server/internal/usecase"
)

// ─── User Handler ─────────────────────────────────────────────────────────────

type UserHandler struct{ uc *usecase.UserUsecase }

func NewUserHandler(uc *usecase.UserUsecase) *UserHandler { return &UserHandler{uc} }

func (h *UserHandler) List(c *gin.Context) {
	search := c.Query("search")
	page, pageSize := pagingParams(c)

	// Build scope-aware specification: data visible depends on user's scope
	scopeCtx := specification.ScopeContext{
		UserID:    middleware.GetUserID(c),
		UserIDCol: "id",
	}
	spec := specification.NewBuilder().
		And(specification.NotDeleted()).
		AndIf(search != "", specification.SearchSpec(search, "username", "full_name", "email")).
		And(specification.NewScopeSpec(middleware.GetScope(c), scopeCtx)).
		Build()

	result, err := h.uc.List(spec, page, pageSize)
	if err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, result)
}

func (h *UserHandler) Get(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	u, err := h.uc.GetByID(id)
	if err != nil {
		fail(c, http.StatusNotFound, err.Error())
		return
	}
	ok(c, u)
}

func (h *UserHandler) Create(c *gin.Context) {
	var req usecase.CreateUserReq
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	u, err := h.uc.Create(&req)
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	created(c, u)
}

func (h *UserHandler) Update(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	var req usecase.UpdateUserReq
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	u, err := h.uc.Update(id, &req)
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	ok(c, u)
}

func (h *UserHandler) Delete(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	if err := h.uc.Delete(id); err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, gin.H{"message": "Đã xóa người dùng"})
}

func (h *UserHandler) ResetPassword(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	var body struct {
		Password        string `json:"password" binding:"required,min=8"`
		OneTimePassword bool   `json:"one_time_password"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.uc.ResetPassword(id, body.Password, body.OneTimePassword); err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, gin.H{"message": "Đặt lại mật khẩu thành công"})
}

package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/owner/auth-server/internal/domain"
	"github.com/owner/auth-server/internal/http/middleware"
	"github.com/owner/auth-server/internal/usecase"
)

// ─── Permission Handler ───────────────────────────────────────────────────────

type PermissionHandler struct{ uc *usecase.PermissionUsecase }

func NewPermissionHandler(uc *usecase.PermissionUsecase) *PermissionHandler {
	return &PermissionHandler{uc}
}

func (h *PermissionHandler) ListAll(c *gin.Context) {
	result, err := h.uc.ListAll()
	if err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, result)
}

func (h *PermissionHandler) Create(c *gin.Context) {
	var req usecase.CreatePermissionReq
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	result, err := h.uc.Create(&req)
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	created(c, result)
}

func (h *PermissionHandler) AddLine(c *gin.Context) {
	code := c.Param("code") // e.g. "user.read"
	var body struct {
		Controller string `json:"controller" binding:"required"`
		Action     string `json:"action" binding:"required"`
		Note       string `json:"note"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	line := &domain.PermissionLine{
		Controller: body.Controller,
		Action:     body.Action,
		Note:       body.Note,
	}
	result, err := h.uc.AddLine(code, line, middleware.GetUsername(c))
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	created(c, result)
}

func (h *PermissionHandler) DeleteLine(c *gin.Context) {
	lineID, err := strconv.ParseUint(c.Param("lineID"), 10, 64)
	if err != nil {
		fail(c, http.StatusBadRequest, "ID không hợp lệ")
		return
	}
	if err := h.uc.DeleteLine(uint(lineID)); err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, gin.H{"message": "Đã xóa dòng chi tiết"})
}

// ─── Menu Handler ─────────────────────────────────────────────────────────────

package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/owner/auth-server/internal/usecase"
)

type ReferenceOptionHandler struct {
	uc *usecase.ReferenceOptionUsecase
}

func NewReferenceOptionHandler(uc *usecase.ReferenceOptionUsecase) *ReferenceOptionHandler {
	return &ReferenceOptionHandler{uc}
}

func (h *ReferenceOptionHandler) List(c *gin.Context) {
	page, pageSize := pagingParams(c)
	filters := map[string]interface{}{
		"search":       c.Query("search"),
		"option_group": c.Query("option_group"),
		"active":       c.Query("active"),
	}
	result, err := h.uc.List(filters, page, pageSize)
	if err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, result)
}

func (h *ReferenceOptionHandler) Get(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	result, err := h.uc.GetByID(id)
	if err != nil {
		fail(c, http.StatusNotFound, err.Error())
		return
	}
	ok(c, result)
}

func (h *ReferenceOptionHandler) Create(c *gin.Context) {
	var req usecase.CreateReferenceOptionReq
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

func (h *ReferenceOptionHandler) Update(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	var req usecase.UpdateReferenceOptionReq
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	result, err := h.uc.Update(id, &req)
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	ok(c, result)
}

func (h *ReferenceOptionHandler) Delete(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	if err := h.uc.Delete(id); err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, gin.H{"message": "Đã xóa reference option"})
}

// ─── Role Handler ─────────────────────────────────────────────────────────────

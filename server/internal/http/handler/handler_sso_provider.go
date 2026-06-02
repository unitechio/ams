package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/owner/auth-server/internal/usecase"
)

type SSOProviderHandler struct{ uc *usecase.SSOProviderUsecase }

func NewSSOProviderHandler(uc *usecase.SSOProviderUsecase) *SSOProviderHandler {
	return &SSOProviderHandler{uc}
}

func (h *SSOProviderHandler) List(c *gin.Context) {
	page, pageSize := pagingParams(c)
	filters := map[string]interface{}{
		"search":  c.Query("search"),
		"type":    c.Query("type"),
		"enabled": c.Query("enabled"),
	}
	result, err := h.uc.List(filters, page, pageSize)
	if err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, result)
}

func (h *SSOProviderHandler) Get(c *gin.Context) {
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

func (h *SSOProviderHandler) Create(c *gin.Context) {
	var req usecase.CreateSSOProviderReq
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

func (h *SSOProviderHandler) Update(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	var req usecase.UpdateSSOProviderReq
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

func (h *SSOProviderHandler) Delete(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	if err := h.uc.Delete(id); err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, gin.H{"message": "Đã xóa SSO provider"})
}

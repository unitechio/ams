package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/owner/auth-server/internal/usecase"
)

type SecurityPolicyHandler struct {
	uc *usecase.SecurityPolicyUsecase
}

func NewSecurityPolicyHandler(uc *usecase.SecurityPolicyUsecase) *SecurityPolicyHandler {
	return &SecurityPolicyHandler{uc}
}

func (h *SecurityPolicyHandler) List(c *gin.Context) {
	page, pageSize := pagingParams(c)
	filters := map[string]interface{}{
		"search":      c.Query("search"),
		"policy_type": c.Query("policy_type"),
		"scope_type":  c.Query("scope_type"),
		"active":      c.Query("active"),
	}
	result, err := h.uc.List(filters, page, pageSize)
	if err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, result)
}

func (h *SecurityPolicyHandler) Get(c *gin.Context) {
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

func (h *SecurityPolicyHandler) Create(c *gin.Context) {
	var req usecase.CreateSecurityPolicyReq
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

func (h *SecurityPolicyHandler) Update(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	var req usecase.UpdateSecurityPolicyReq
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

func (h *SecurityPolicyHandler) Delete(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	if err := h.uc.Delete(id); err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, gin.H{"message": "Đã xóa security policy"})
}

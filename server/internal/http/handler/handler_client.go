package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/owner/auth-server/internal/usecase"
)

type ClientHandler struct{ uc *usecase.ClientUsecase }

func NewClientHandler(uc *usecase.ClientUsecase) *ClientHandler { return &ClientHandler{uc} }

func (h *ClientHandler) List(c *gin.Context) {
	page, pageSize := pagingParams(c)
	filters := map[string]interface{}{
		"search":   c.Query("search"),
		"app_type": c.Query("app_type"),
	}
	result, err := h.uc.List(filters, page, pageSize)
	if err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, result)
}

func (h *ClientHandler) Get(c *gin.Context) {
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

func (h *ClientHandler) Create(c *gin.Context) {
	var req usecase.CreateClientReq
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

func (h *ClientHandler) Update(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	var req usecase.UpdateClientReq
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

func (h *ClientHandler) Delete(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	if err := h.uc.Delete(id); err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, gin.H{"message": "Đã xóa auth client"})
}

func (h *ClientHandler) RotateSecret(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	result, err := h.uc.RotateSecret(id)
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	ok(c, result)
}

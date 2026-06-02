package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/owner/auth-server/internal/usecase"
)

type LogHandler struct {
	uc *usecase.LogUsecase
}

func (h *LogHandler) ListAuditLogs(c *gin.Context) {
	page, pageSize := pagingParams(c)
	spec := map[string]interface{}{
		"search":    c.Query("search"),
		"user":      c.Query("user"),
		"action":    c.Query("action"),
		"from":      c.Query("from"),
		"to":        c.Query("to"),
		"page":      page,
		"page_size": pageSize,
	}
	result, err := h.uc.ListAuditLogs(spec)
	if err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, result)
}

func (h *LogHandler) ListAuthHistory(c *gin.Context) {
	page, pageSize := pagingParams(c)
	spec := map[string]interface{}{
		"search":    c.Query("search"),
		"page":      page,
		"page_size": pageSize,
	}
	result, err := h.uc.ListAuthHistory(spec)
	if err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, result)
}

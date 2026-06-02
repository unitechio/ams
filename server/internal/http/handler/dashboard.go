package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type DashboardHandler struct {
	db *gorm.DB
}

func NewDashboardHandler(db *gorm.DB) *DashboardHandler {
	return &DashboardHandler{db: db}
}

func (h *DashboardHandler) GetStats(c *gin.Context) {
	// 1. User Status Distribution
	type userStatusStat struct {
		Status string `json:"status"`
		Count  int    `json:"count"`
	}
	var userStatus []userStatusStat
	h.db.Table("sys_users").
		Select("status, count(*) as count").
		Where("deleted = false").
		Group("status").
		Scan(&userStatus)
	if userStatus == nil {
		userStatus = []userStatusStat{}
	}

	// 2. Login Activity last 7 days – fill every day even if no data
	type loginActivityStat struct {
		Date    string `json:"date"`
		Success int    `json:"success"`
		Failed  int    `json:"failed"`
	}

	type rawRow struct {
		Date    string
		Success int
		Failed  int
	}
	var raw []rawRow
	sevenDaysAgo := time.Now().Truncate(24 * time.Hour).AddDate(0, 0, -6)
	h.db.Table("sys_auth_histories").
		Select(`
			TO_CHAR(DATE_TRUNC('day', created_at), 'MM-DD') as date,
			SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
			SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) as failed
		`).
		Where("created_at >= ?", sevenDaysAgo).
		Group("DATE_TRUNC('day', created_at)").
		Order("date ASC").
		Scan(&raw)

	// Build a map for quick lookup
	rawMap := make(map[string]rawRow, len(raw))
	for _, r := range raw {
		rawMap[r.Date] = r
	}

	// Fill every day in [sevenDaysAgo, today]
	loginActivity := make([]loginActivityStat, 7)
	for i := 0; i < 7; i++ {
		day := sevenDaysAgo.AddDate(0, 0, i)
		key := day.Format("01-02")
		r := rawMap[key]
		loginActivity[i] = loginActivityStat{
			Date:    key,
			Success: r.Success,
			Failed:  r.Failed,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"user_status_distribution": userStatus,
			"login_activity_7d":        loginActivity,
		},
	})
}


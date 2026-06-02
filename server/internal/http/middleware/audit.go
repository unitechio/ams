package middleware

import (
	"bytes"
	"io"
	"net/http"
	"time"

	"context"
	"github.com/gin-gonic/gin"
	"github.com/owner/auth-server/internal/domain"
)

type AuditLogger interface {
	Save(ctx context.Context, log *domain.AuditLog) error
}

type responseWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w responseWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

// Audit middleware captures request and response data and saves it to AuditLog.
// It should be placed after Authenticate to capture userID/username.
func Audit(logger AuditLogger) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Only audit mutations (POST, PUT, DELETE) or specific sensitive GETs
		if c.Request.Method == http.MethodGet || c.Request.Method == http.MethodOptions {
			c.Next()
			return
		}

		start := time.Now()

		// Read request body
		var reqBody []byte
		if c.Request.Body != nil {
			reqBody, _ = io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(reqBody))
		}

		// Wrap response writer to capture body
		w := &responseWriter{body: bytes.NewBufferString(""), ResponseWriter: c.Writer}
		c.Writer = w

		c.Next()

		// Skip if not authenticated (though usually it is)
		userID := GetUserID(c)
		username := GetUsername(c)
		if username == "" {
			username = "anonymous"
		}

		// Prepare log entry
		auditLog := &domain.AuditLog{
			UserID:     userID,
			Username:   username,
			Action:     c.Request.Method + ":" + c.Request.URL.Path,
			Resource:   c.Request.URL.Path,
			ResourceID: c.Param("id"),
			IPAddress:  c.ClientIP(),
			UserAgent:  c.Request.UserAgent(),
			Request:    string(reqBody),
			Response:   w.body.String(),
			Allowed:    c.Writer.Status() < 400,
			CreatedAt:  start,
		}

		// Save log (non-blocking if possible, but here we do it simple)
		go logger.Save(context.Background(), auditLog)
	}
}

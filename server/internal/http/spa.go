package http

import (
	"bytes"
	"io/fs"
	"mime"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func AttachSPA(r *gin.Engine, assetFS fs.FS) {
	r.NoRoute(func(c *gin.Context) {
		if c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Không tìm thấy tài nguyên"})
			return
		}

		requestPath := strings.TrimPrefix(path.Clean(c.Request.URL.Path), "/")
		switch {
		case strings.HasPrefix(requestPath, "api/"),
			requestPath == "health",
			requestPath == "readyz",
			requestPath == "metrics",
			strings.HasPrefix(requestPath, "debug/pprof"):
			c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Không tìm thấy tài nguyên"})
			return
		}

		if requestPath == "." || requestPath == "" {
			requestPath = "index.html"
		}

		if served := tryServeStatic(c, assetFS, requestPath); served {
			return
		}

		if path.Ext(requestPath) != "" {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Không tìm thấy tài nguyên"})
			return
		}

		serveEmbeddedFile(c, assetFS, "index.html", false)
	})
}

func tryServeStatic(c *gin.Context, assetFS fs.FS, name string) bool {
	if _, err := fs.Stat(assetFS, name); err != nil {
		return false
	}
	immutable := strings.HasPrefix(name, "assets/")
	serveEmbeddedFile(c, assetFS, name, immutable)
	return true
}

func serveEmbeddedFile(c *gin.Context, assetFS fs.FS, name string, immutable bool) {
	body, err := fs.ReadFile(assetFS, name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Không tìm thấy tài nguyên"})
		return
	}

	if immutable {
		c.Header("Cache-Control", "public, max-age=31536000, immutable")
	} else {
		c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	}

	contentType := mime.TypeByExtension(path.Ext(name))
	if contentType == "" {
		contentType = http.DetectContentType(body)
	}
	c.Header("Content-Type", contentType)
	http.ServeContent(c.Writer, c.Request, name, time.Time{}, bytes.NewReader(body))
}

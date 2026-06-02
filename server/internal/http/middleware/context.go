package middleware

import "github.com/gin-gonic/gin"

func GetUserID(c *gin.Context) uint {
	val, _ := c.Get("userID")
	id, _ := val.(uint)
	return id
}

func GetUsername(c *gin.Context) string {
	val, _ := c.Get("username")
	s, _ := val.(string)
	return s
}

func GetSessionID(c *gin.Context) string {
	val, _ := c.Get("sessionID")
	s, _ := val.(string)
	return s
}

func GetClientID(c *gin.Context) string {
	val, _ := c.Get("clientID")
	s, _ := val.(string)
	return s
}

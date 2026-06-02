package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/owner/auth-server/internal/http/middleware"
	"github.com/owner/auth-server/internal/usecase"
)

// ─── Auth Handler ─────────────────────────────────────────────────────────────

type AuthHandler struct{ uc *usecase.AuthUsecase }

func NewAuthHandler(uc *usecase.AuthUsecase) *AuthHandler { return &AuthHandler{uc} }

func (h *AuthHandler) Login(c *gin.Context) {
	var req usecase.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	req.IPAddress = c.ClientIP()
	req.UserAgent = c.Request.UserAgent()

	resp, err := h.uc.Login(&req)
	if err != nil {
		fail(c, http.StatusUnauthorized, err.Error())
		return
	}
	ok(c, resp)
}

func (h *AuthHandler) Authorize(c *gin.Context) {
	var req usecase.AuthorizeCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	req.IPAddress = c.ClientIP()
	req.UserAgent = c.Request.UserAgent()
	resp, err := h.uc.AuthorizeCode(&req)
	if err != nil {
		status := http.StatusUnauthorized
		if err == usecase.ErrOTPRequired {
			status = http.StatusPreconditionRequired
		}
		fail(c, status, err.Error())
		return
	}
	ok(c, resp)
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var body struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	resp, err := h.uc.RefreshToken(body.RefreshToken)
	if err != nil {
		fail(c, http.StatusUnauthorized, err.Error())
		return
	}
	ok(c, resp)
}

func (h *AuthHandler) Token(c *gin.Context) {
	var body struct {
		ClientID     string `json:"client_id" binding:"required"`
		ClientSecret string `json:"client_secret"`
		GrantType    string `json:"grant_type" binding:"required"`
		Code         string `json:"code"`
		RedirectURI  string `json:"redirect_uri"`
		CodeVerifier string `json:"code_verifier"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	var (
		resp interface{}
		err  error
	)
	switch body.GrantType {
	case "client_credentials":
		resp, err = h.uc.IssueClientToken(body.ClientID, body.ClientSecret, body.GrantType)
	case "authorization_code":
		resp, err = h.uc.ExchangeAuthorizationCode(body.ClientID, body.ClientSecret, body.Code, body.RedirectURI, body.CodeVerifier)
	default:
		err = errors.New("grant_type chưa được hỗ trợ")
	}
	if err != nil {
		fail(c, http.StatusUnauthorized, err.Error())
		return
	}
	ok(c, resp)
}

func (h *AuthHandler) SSOProviders(c *gin.Context) {
	ok(c, h.uc.ListSSOProviders())
}

func (h *AuthHandler) StartSSO(c *gin.Context) {
	redirectURL, err := h.uc.StartSSO(c.Param("provider"))
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	ok(c, gin.H{"redirect_url": redirectURL})
}

func (h *AuthHandler) CompleteSSO(c *gin.Context) {
	var body struct {
		Code              string `json:"code" binding:"required"`
		State             string `json:"state" binding:"required"`
		ClientID          string `json:"client_id"`
		Channel           string `json:"channel"`
		DeviceName        string `json:"device_name"`
		DeviceFingerprint string `json:"device_fingerprint"`
		OTPCode           string `json:"otp_code"`
		TrustDevice       bool   `json:"trust_device"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	resp, err := h.uc.CompleteSSO(c.Param("provider"), body.Code, body.State, &usecase.CompleteSSORequest{
		ClientID:          body.ClientID,
		Channel:           body.Channel,
		DeviceName:        body.DeviceName,
		DeviceFingerprint: body.DeviceFingerprint,
		OTPCode:           body.OTPCode,
		TrustDevice:       body.TrustDevice,
		IPAddress:         c.ClientIP(),
		UserAgent:         c.Request.UserAgent(),
	})
	if err != nil {
		status := http.StatusUnauthorized
		if err == usecase.ErrOTPRequired {
			status = http.StatusPreconditionRequired
		}
		fail(c, status, err.Error())
		return
	}
	ok(c, resp)
}

func (h *AuthHandler) Logout(c *gin.Context) {
	h.uc.Logout(middleware.GetUserID(c), middleware.GetSessionID(c))
	ok(c, gin.H{"message": "Đã đăng xuất thành công"})
}

func (h *AuthHandler) Me(c *gin.Context) {
	info, err := h.uc.Me(middleware.GetUserID(c))
	if err != nil {
		fail(c, http.StatusNotFound, err.Error())
		return
	}
	ok(c, info)
}

func (h *AuthHandler) ChangePassword(c *gin.Context) {
	var body struct {
		OldPassword string `json:"old_password" binding:"required"`
		NewPassword string `json:"new_password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.uc.ChangePassword(middleware.GetUserID(c), body.OldPassword, body.NewPassword); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	ok(c, gin.H{"message": "Đổi mật khẩu thành công"})
}

func (h *AuthHandler) Sessions(c *gin.Context) {
	sessions, err := h.uc.ListSessions(middleware.GetUserID(c), middleware.GetSessionID(c))
	if err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, sessions)
}

func (h *AuthHandler) RevokeSession(c *gin.Context) {
	sessionID := c.Param("id")
	if err := h.uc.RevokeSession(middleware.GetUserID(c), sessionID); err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, gin.H{"message": "Thu hồi phiên thành công"})
}

func (h *AuthHandler) RevokeAllSessions(c *gin.Context) {
	if err := h.uc.RevokeAllSessions(middleware.GetUserID(c)); err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, gin.H{"message": "Đã thu hồi tất cả phiên khác"})
}

func (h *AuthHandler) Devices(c *gin.Context) {
	page, pageSize := pagingParams(c)
	filters := map[string]interface{}{
		"search":    c.Query("search"),
		"client_id": c.Query("client_id"),
		"trusted":   c.Query("trusted"),
		"page":      page,
		"page_size": pageSize,
	}
	result, err := h.uc.ListDevices(filters)
	if err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, result)
}

func (h *AuthHandler) RevokeDevice(c *gin.Context) {
	if err := h.uc.AdminRevokeDevice(c.Param("id")); err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, gin.H{"message": "Đã thu hồi thiết bị"})
}

func (h *AuthHandler) Setup2FA(c *gin.Context) {
	data, err := h.uc.Setup2FA(middleware.GetUserID(c))
	if err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, data)
}

func (h *AuthHandler) Verify2FA(c *gin.Context) {
	var body struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.uc.Verify2FA(middleware.GetUserID(c), body.Code); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	ok(c, gin.H{"message": "Xác thực 2 bước đã được bật"})
}

func (h *AuthHandler) Disable2FA(c *gin.Context) {
	if err := h.uc.Disable2FA(middleware.GetUserID(c)); err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, gin.H{"message": "Xác thực 2 bước đã được tắt"})
}

func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var body struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.uc.ForgotPassword(body.Email); err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, gin.H{"message": "Email khôi phục đã được gửi"})
}

func (h *AuthHandler) ResetPasswordWithToken(c *gin.Context) {
	var body struct {
		Token       string `json:"token" binding:"required"`
		NewPassword string `json:"new_password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.uc.ResetPasswordWithToken(body.Token, body.NewPassword); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	ok(c, gin.H{"message": "Mật khẩu đã được đặt lại thành công"})
}

func (h *AuthHandler) SendVerificationEmail(c *gin.Context) {
	if err := h.uc.SendVerificationEmail(middleware.GetUserID(c)); err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, gin.H{"message": "Email xác minh đã được gửi"})
}

func (h *AuthHandler) StepUp(c *gin.Context) {
	var body struct {
		Password string `json:"password" binding:"required"`
		OTPCode  string `json:"otp_code"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	resp, err := h.uc.StepUp(middleware.GetUserID(c), middleware.GetSessionID(c), middleware.GetClientID(c), body.Password, body.OTPCode)
	if err != nil {
		status := http.StatusUnauthorized
		if err == usecase.ErrOTPRequired {
			status = http.StatusPreconditionRequired
		}
		fail(c, status, err.Error())
		return
	}
	ok(c, resp)
}

func (h *AuthHandler) VerifyEmail(c *gin.Context) {
	var body struct {
		Token string `json:"token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.uc.VerifyEmail(body.Token); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	ok(c, gin.H{"message": "Email đã được xác minh thành công"})
}

// ─── User Handler ─────────────────────────────────────────────────────────────

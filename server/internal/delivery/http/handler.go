package http

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/owner/auth-server/internal/authorization/permission"
	"github.com/owner/auth-server/internal/authorization/specification"
	"github.com/owner/auth-server/internal/domain"
	"github.com/owner/auth-server/internal/middleware"
	"github.com/owner/auth-server/internal/usecase"
)

// ─── Response helpers ─────────────────────────────────────────────────────────

func ok(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

func created(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": data})
}

func fail(c *gin.Context, code int, msg string) {
	c.AbortWithStatusJSON(code, gin.H{"success": false, "error": msg})
}

func parseID(c *gin.Context) (uint, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		fail(c, http.StatusBadRequest, "ID không hợp lệ")
		return 0, false
	}
	return uint(id), true
}

func pagingParams(c *gin.Context) (page, pageSize int) {
	page, _ = strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ = strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return
}

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

type UserHandler struct{ uc *usecase.UserUsecase }

func NewUserHandler(uc *usecase.UserUsecase) *UserHandler { return &UserHandler{uc} }

func (h *UserHandler) List(c *gin.Context) {
	search := c.Query("search")
	page, pageSize := pagingParams(c)

	// Build scope-aware specification: data visible depends on user's scope
	scopeCtx := specification.ScopeContext{
		UserID:    middleware.GetUserID(c),
		UserIDCol: "id",
	}
	spec := specification.NewBuilder().
		And(specification.NotDeleted()).
		AndIf(search != "", specification.SearchSpec(search, "username", "full_name", "email")).
		And(specification.NewScopeSpec(middleware.GetScope(c), scopeCtx)).
		Build()

	result, err := h.uc.List(spec, page, pageSize)
	if err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, result)
}

func (h *UserHandler) Get(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	u, err := h.uc.GetByID(id)
	if err != nil {
		fail(c, http.StatusNotFound, err.Error())
		return
	}
	ok(c, u)
}

func (h *UserHandler) Create(c *gin.Context) {
	var req usecase.CreateUserReq
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	u, err := h.uc.Create(&req)
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	created(c, u)
}

func (h *UserHandler) Update(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	var req usecase.UpdateUserReq
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	u, err := h.uc.Update(id, &req)
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	ok(c, u)
}

func (h *UserHandler) Delete(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	if err := h.uc.Delete(id); err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, gin.H{"message": "Đã xóa người dùng"})
}

func (h *UserHandler) ResetPassword(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	var body struct {
		Password        string `json:"password" binding:"required,min=8"`
		OneTimePassword bool   `json:"one_time_password"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.uc.ResetPassword(id, body.Password, body.OneTimePassword); err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, gin.H{"message": "Đặt lại mật khẩu thành công"})
}

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

type LoginChannelHandler struct{ uc *usecase.LoginChannelUsecase }

func NewLoginChannelHandler(uc *usecase.LoginChannelUsecase) *LoginChannelHandler {
	return &LoginChannelHandler{uc}
}

func (h *LoginChannelHandler) List(c *gin.Context) {
	page, pageSize := pagingParams(c)
	filters := map[string]interface{}{
		"search":     c.Query("search"),
		"risk_level": c.Query("risk_level"),
		"active":     c.Query("active"),
	}
	result, err := h.uc.List(filters, page, pageSize)
	if err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, result)
}

func (h *LoginChannelHandler) Create(c *gin.Context) {
	var req usecase.CreateLoginChannelReq
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

func (h *LoginChannelHandler) Update(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	var req usecase.UpdateLoginChannelReq
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

func (h *LoginChannelHandler) Delete(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	if err := h.uc.Delete(id); err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, gin.H{"message": "Đã xóa login channel"})
}

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

type RoleHandler struct{ uc *usecase.RoleUsecase }

func NewRoleHandler(uc *usecase.RoleUsecase) *RoleHandler { return &RoleHandler{uc} }

func (h *RoleHandler) List(c *gin.Context) {
	search := c.Query("search")
	page, pageSize := pagingParams(c)
	spec := specification.NewBuilder().
		And(specification.NotDeleted()).
		AndIf(search != "", specification.SearchSpec(search, "name", "description")).
		Build()
	result, err := h.uc.List(spec, page, pageSize)
	if err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, result)
}

func (h *RoleHandler) Get(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	r, err := h.uc.GetByID(id)
	if err != nil {
		fail(c, http.StatusNotFound, err.Error())
		return
	}
	ok(c, r)
}

func (h *RoleHandler) Create(c *gin.Context) {
	var req usecase.CreateRoleReq
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	r, err := h.uc.Create(&req, middleware.GetUsername(c))
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	created(c, r)
}

func (h *RoleHandler) Update(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	var req usecase.UpdateRoleReq
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	r, err := h.uc.Update(id, &req)
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	ok(c, r)
}

func (h *RoleHandler) Delete(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	if err := h.uc.Delete(id); err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, gin.H{"message": "Đã xóa vai trò"})
}

func (h *RoleHandler) AssignPermissions(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	var req usecase.AssignPermReq
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.uc.AssignPermissions(id, &req); err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, gin.H{"message": "Gán quyền thành công"})
}

// ─── Permission Handler ───────────────────────────────────────────────────────

type PermissionHandler struct{ uc *usecase.PermissionUsecase }

func NewPermissionHandler(uc *usecase.PermissionUsecase) *PermissionHandler {
	return &PermissionHandler{uc}
}

func (h *PermissionHandler) ListAll(c *gin.Context) {
	result, err := h.uc.ListAll()
	if err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, result)
}

func (h *PermissionHandler) Create(c *gin.Context) {
	var req usecase.CreatePermissionReq
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

func (h *PermissionHandler) AddLine(c *gin.Context) {
	code := c.Param("code") // e.g. "user.read"
	var body struct {
		Controller string `json:"controller" binding:"required"`
		Action     string `json:"action" binding:"required"`
		Note       string `json:"note"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	line := &domain.PermissionLine{
		Controller: body.Controller,
		Action:     body.Action,
		Note:       body.Note,
	}
	result, err := h.uc.AddLine(code, line, middleware.GetUsername(c))
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	created(c, result)
}

func (h *PermissionHandler) DeleteLine(c *gin.Context) {
	lineID, err := strconv.ParseUint(c.Param("lineID"), 10, 64)
	if err != nil {
		fail(c, http.StatusBadRequest, "ID không hợp lệ")
		return
	}
	if err := h.uc.DeleteLine(uint(lineID)); err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, gin.H{"message": "Đã xóa dòng chi tiết"})
}

// ─── Menu Handler ─────────────────────────────────────────────────────────────

type MenuHandler struct{ uc *usecase.MenuUsecase }

func NewMenuHandler(uc *usecase.MenuUsecase) *MenuHandler { return &MenuHandler{uc} }

func (h *MenuHandler) List(c *gin.Context) {
	search := c.Query("search")
	page, pageSize := pagingParams(c)
	spec := specification.NewBuilder().
		And(specification.NotDeleted()).
		AndIf(search != "", specification.SearchSpec(search, "title", "url")).
		Build()
	result, err := h.uc.ListPaginated(spec, page, pageSize)
	if err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, result)
}

// MyMenus returns permission-filtered menu tree for the current user.
// This is the endpoint the FE sidebar calls to build navigation.
func (h *MenuHandler) MyMenus(c *gin.Context) {
	val, exists := c.Get("permissionSet")
	if !exists {
		ok(c, []interface{}{})
		return
	}
	permSet, _ := val.(*permission.PermissionSet)
	menus, err := h.uc.GetFiltered(permSet)
	if err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, menus)
}

func (h *MenuHandler) Create(c *gin.Context) {
	var req usecase.CreateMenuReq
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	m, err := h.uc.Create(&req)
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	created(c, m)
}

func (h *MenuHandler) Update(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	var req usecase.CreateMenuReq
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	m, err := h.uc.Update(id, &req)
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	ok(c, m)
}

func (h *MenuHandler) Delete(c *gin.Context) {
	id, valid := parseID(c)
	if !valid {
		return
	}
	if err := h.uc.Delete(id); err != nil {
		fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	ok(c, gin.H{"message": "Đã xóa menu"})
}

// ─── Log Handler ──────────────────────────────────────────────────────────────

func NewLogHandler(uc *usecase.LogUsecase) *LogHandler {
	return &LogHandler{uc}
}

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

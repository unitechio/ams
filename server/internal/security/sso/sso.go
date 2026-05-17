package sso

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

type Provider struct {
	ID                 string `json:"id"`
	Name               string `json:"name"`
	Type               string `json:"type"`
	AllowAutoProvision bool   `json:"allow_auto_provision"`
	ClientID           string `json:"client_id,omitempty"`
	ClientSecret       string `json:"-"`
	AuthorizeURL       string `json:"authorize_url,omitempty"`
	TokenURL           string `json:"token_url,omitempty"`
	UserInfoURL        string `json:"user_info_url,omitempty"`
	RedirectURI        string `json:"redirect_uri,omitempty"`
	Scope              string `json:"scope,omitempty"`
	SAMLLoginURL       string `json:"saml_login_url,omitempty"`
}

type Identity struct {
	Provider      string `json:"provider"`
	Subject       string `json:"subject"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Username      string `json:"username"`
}

type stateEntry struct {
	ProviderID string
	ExpiresAt  time.Time
}

var stateStore = struct {
	sync.Mutex
	m map[string]stateEntry
}{m: make(map[string]stateEntry)}

func List() []Provider {
	providers := []Provider{
		loadOIDCProvider(
			"google",
			"Google",
			"https://accounts.google.com/o/oauth2/v2/auth",
			"https://oauth2.googleapis.com/token",
			"https://openidconnect.googleapis.com/v1/userinfo",
			"openid profile email",
		),
		loadOIDCProvider(
			"github",
			"GitHub",
			"https://github.com/login/oauth/authorize",
			"https://github.com/login/oauth/access_token",
			"https://api.github.com/user",
			"read:user user:email",
		),
		loadOIDCProvider(
			"microsoft",
			"Microsoft",
			"https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
			"https://login.microsoftonline.com/common/oauth2/v2.0/token",
			"https://graph.microsoft.com/oidc/userinfo",
			"openid profile email",
		),
		loadSAMLProvider("enterprise", "Enterprise SAML"),
	}
	result := make([]Provider, 0, len(providers))
	for _, provider := range providers {
		if provider.ID != "" {
			result = append(result, provider)
		}
	}
	return result
}

func StartURLForProvider(provider Provider) (string, string, error) {
	if strings.TrimSpace(provider.ID) == "" {
		return "", "", errors.New("provider SSO không tồn tại hoặc chưa được cấu hình")
	}
	state, err := newState(provider.ID)
	if err != nil {
		return "", "", err
	}
	switch provider.Type {
	case "oauth2", "oidc":
		q := url.Values{}
		q.Set("response_type", "code")
		q.Set("client_id", provider.ClientID)
		q.Set("redirect_uri", provider.RedirectURI)
		q.Set("scope", provider.Scope)
		q.Set("state", state)
		return provider.AuthorizeURL + "?" + q.Encode(), state, nil
	case "saml":
		q := url.Values{}
		q.Set("RelayState", state)
		return provider.SAMLLoginURL + "?" + q.Encode(), state, nil
	}
	return "", "", errors.New("provider SSO không tồn tại hoặc chưa được cấu hình")
}

func StartURL(providerID string) (string, string, error) {
	provider, err := findProvider(providerID)
	if err != nil {
		return "", "", err
	}
	return StartURLForProvider(*provider)
}

func Complete(providerID, state, code string) (*Identity, error) {
	provider, err := findProvider(providerID)
	if err != nil {
		return nil, err
	}
	return CompleteWithProvider(*provider, state, code)
}

func CompleteWithProvider(provider Provider, state, code string) (*Identity, error) {
	if err := consumeState(provider.ID, state); err != nil {
		return nil, err
	}
	switch provider.Type {
	case "oauth2", "oidc":
		return exchangeOIDC(&provider, code)
	case "saml":
		return nil, errors.New("SAML callback cần ACS/metadata riêng, chưa hỗ trợ qua complete endpoint này")
	default:
		return nil, errors.New("provider SSO không tồn tại hoặc chưa được cấu hình")
	}
}

func findProvider(providerID string) (*Provider, error) {
	for _, provider := range List() {
		if provider.ID == providerID {
			cloned := provider
			return &cloned, nil
		}
	}
	return nil, errors.New("provider SSO không tồn tại hoặc chưa được cấu hình")
}

func loadOIDCProvider(key, name, authorizeURL, tokenURL, userInfoURL, defaultScope string) Provider {
	prefix := "SSO_" + strings.ToUpper(key) + "_"
	clientID := strings.TrimSpace(os.Getenv(prefix + "CLIENT_ID"))
	clientSecret := strings.TrimSpace(os.Getenv(prefix + "CLIENT_SECRET"))
	redirectURI := strings.TrimSpace(os.Getenv(prefix + "REDIRECT_URI"))
	if clientID == "" || redirectURI == "" {
		return Provider{}
	}
	scope := strings.TrimSpace(os.Getenv(prefix + "SCOPE"))
	if scope == "" {
		scope = defaultScope
	}
	customAuthorizeURL := strings.TrimSpace(os.Getenv(prefix + "AUTHORIZE_URL"))
	if customAuthorizeURL != "" {
		authorizeURL = customAuthorizeURL
	}
	customTokenURL := strings.TrimSpace(os.Getenv(prefix + "TOKEN_URL"))
	if customTokenURL != "" {
		tokenURL = customTokenURL
	}
	customUserInfoURL := strings.TrimSpace(os.Getenv(prefix + "USERINFO_URL"))
	if customUserInfoURL != "" {
		userInfoURL = customUserInfoURL
	}
	providerType := strings.TrimSpace(os.Getenv(prefix + "TYPE"))
	if providerType == "" {
		providerType = "oidc"
	}
	return Provider{
		ID:                 key,
		Name:               name,
		Type:               providerType,
		AllowAutoProvision: true,
		ClientID:           clientID,
		ClientSecret:       clientSecret,
		AuthorizeURL:       authorizeURL,
		TokenURL:           tokenURL,
		UserInfoURL:        userInfoURL,
		RedirectURI:        redirectURI,
		Scope:              scope,
	}
}

func loadSAMLProvider(key, name string) Provider {
	prefix := "SSO_" + strings.ToUpper(key) + "_"
	loginURL := strings.TrimSpace(os.Getenv(prefix + "LOGIN_URL"))
	if loginURL == "" {
		return Provider{}
	}
	return Provider{
		ID:                 key,
		Name:               name,
		Type:               "saml",
		AllowAutoProvision: false,
		SAMLLoginURL:       loginURL,
		RedirectURI:        strings.TrimSpace(os.Getenv(prefix + "REDIRECT_URI")),
	}
}

func newState(providerID string) (string, error) {
	raw := make([]byte, 24)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	state := base64.RawURLEncoding.EncodeToString(raw)
	stateStore.Lock()
	stateStore.m[state] = stateEntry{ProviderID: providerID, ExpiresAt: time.Now().Add(10 * time.Minute)}
	stateStore.Unlock()
	return state, nil
}

func consumeState(providerID, state string) error {
	state = strings.TrimSpace(state)
	if state == "" {
		return errors.New("state không hợp lệ")
	}
	stateStore.Lock()
	entry, ok := stateStore.m[state]
	if ok {
		delete(stateStore.m, state)
	}
	stateStore.Unlock()
	if !ok || entry.ExpiresAt.Before(time.Now()) {
		return errors.New("state không hợp lệ hoặc đã hết hạn")
	}
	if entry.ProviderID != providerID {
		return errors.New("state không thuộc về provider hiện tại")
	}
	return nil
}

func exchangeOIDC(provider *Provider, code string) (*Identity, error) {
	if strings.TrimSpace(provider.TokenURL) == "" {
		return nil, errors.New("provider chưa cấu hình token endpoint")
	}
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", strings.TrimSpace(code))
	form.Set("redirect_uri", provider.RedirectURI)
	form.Set("client_id", provider.ClientID)
	if provider.ClientSecret != "" {
		form.Set("client_secret", provider.ClientSecret)
	}
	req, err := http.NewRequest(http.MethodPost, provider.TokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("token exchange thất bại: %s", strings.TrimSpace(string(body)))
	}
	var tokenResp struct {
		AccessToken string `json:"access_token"`
		IDToken     string `json:"id_token"`
	}
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, err
	}
	if strings.TrimSpace(tokenResp.AccessToken) == "" && strings.TrimSpace(tokenResp.IDToken) == "" {
		return nil, errors.New("provider không trả về access_token hoặc id_token")
	}
	if strings.TrimSpace(provider.UserInfoURL) != "" && strings.TrimSpace(tokenResp.AccessToken) != "" {
		identity, err := fetchUserInfo(provider, tokenResp.AccessToken)
		if err == nil {
			return identity, nil
		}
	}
	if strings.TrimSpace(tokenResp.IDToken) != "" {
		return identityFromIDToken(provider.ID, tokenResp.IDToken)
	}
	return nil, errors.New("không lấy được thông tin định danh từ provider")
}

func fetchUserInfo(provider *Provider, accessToken string) (*Identity, error) {
	req, err := http.NewRequest(http.MethodGet, provider.UserInfoURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("userinfo thất bại: %s", strings.TrimSpace(string(body)))
	}
	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	return identityFromPayload(provider.ID, payload)
}

func identityFromIDToken(providerID, rawToken string) (*Identity, error) {
	parts := strings.Split(rawToken, ".")
	if len(parts) < 2 {
		return nil, errors.New("id_token không hợp lệ")
	}
	payloadJSON, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, err
	}
	var payload map[string]interface{}
	if err := json.Unmarshal(payloadJSON, &payload); err != nil {
		return nil, err
	}
	return identityFromPayload(providerID, payload)
}

func identityFromPayload(providerID string, payload map[string]interface{}) (*Identity, error) {
	identity := &Identity{
		Provider:      providerID,
		Subject:       firstString(payload, "sub", "id"),
		Email:         firstString(payload, "email"),
		EmailVerified: firstBool(payload, "email_verified", "verified"),
		Name:          firstString(payload, "name"),
		Username:      firstString(payload, "preferred_username", "login", "username"),
	}
	if identity.Name == "" {
		identity.Name = identity.Username
	}
	if identity.Name == "" {
		identity.Name = identity.Email
	}
	if identity.Subject == "" {
		return nil, errors.New("provider không trả về subject")
	}
	if identity.Email == "" {
		return nil, errors.New("provider không trả về email")
	}
	return identity, nil
}

func firstString(payload map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		value, ok := payload[key]
		if !ok || value == nil {
			continue
		}
		switch v := value.(type) {
		case string:
			if strings.TrimSpace(v) != "" {
				return strings.TrimSpace(v)
			}
		case float64:
			return strings.TrimSpace(fmt.Sprintf("%.0f", v))
		}
	}
	return ""
}

func firstBool(payload map[string]interface{}, keys ...string) bool {
	for _, key := range keys {
		value, ok := payload[key]
		if !ok || value == nil {
			continue
		}
		switch v := value.(type) {
		case bool:
			return v
		case string:
			return strings.EqualFold(strings.TrimSpace(v), "true")
		}
	}
	return false
}

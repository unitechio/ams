package sso

import (
	"errors"
	"net/url"
	"os"
	"strings"
)

type Provider struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Type         string `json:"type"`
	ClientID     string `json:"client_id,omitempty"`
	AuthorizeURL string `json:"authorize_url,omitempty"`
	RedirectURI  string `json:"redirect_uri,omitempty"`
	Scope        string `json:"scope,omitempty"`
	SAMLLoginURL string `json:"saml_login_url,omitempty"`
}

func List() []Provider {
	providers := []Provider{
		loadOIDCProvider("google", "Google", "https://accounts.google.com/o/oauth2/v2/auth", "openid profile email"),
		loadOIDCProvider("github", "GitHub", "https://github.com/login/oauth/authorize", "read:user user:email"),
		loadOIDCProvider("microsoft", "Microsoft", "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", "openid profile email"),
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

func StartURL(providerID string, state string) (string, error) {
	for _, provider := range List() {
		if provider.ID != providerID {
			continue
		}
		switch provider.Type {
		case "oauth2", "oidc":
			q := url.Values{}
			q.Set("response_type", "code")
			q.Set("client_id", provider.ClientID)
			q.Set("redirect_uri", provider.RedirectURI)
			q.Set("scope", provider.Scope)
			q.Set("state", state)
			return provider.AuthorizeURL + "?" + q.Encode(), nil
		case "saml":
			q := url.Values{}
			q.Set("RelayState", state)
			return provider.SAMLLoginURL + "?" + q.Encode(), nil
		}
	}
	return "", errors.New("provider SSO không tồn tại hoặc chưa được cấu hình")
}

func loadOIDCProvider(key, name, authorizeURL, defaultScope string) Provider {
	prefix := "SSO_" + strings.ToUpper(key) + "_"
	clientID := strings.TrimSpace(os.Getenv(prefix + "CLIENT_ID"))
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
	providerType := strings.TrimSpace(os.Getenv(prefix + "TYPE"))
	if providerType == "" {
		providerType = "oidc"
	}
	return Provider{
		ID:           key,
		Name:         name,
		Type:         providerType,
		ClientID:     clientID,
		AuthorizeURL: authorizeURL,
		RedirectURI:  redirectURI,
		Scope:        scope,
	}
}

func loadSAMLProvider(key, name string) Provider {
	prefix := "SSO_" + strings.ToUpper(key) + "_"
	loginURL := strings.TrimSpace(os.Getenv(prefix + "LOGIN_URL"))
	if loginURL == "" {
		return Provider{}
	}
	return Provider{
		ID:           key,
		Name:         name,
		Type:         "saml",
		SAMLLoginURL: loginURL,
		RedirectURI:  strings.TrimSpace(os.Getenv(prefix + "REDIRECT_URI")),
	}
}

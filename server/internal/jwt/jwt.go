package jwt

import (
	"errors"
	"time"

	gojwt "github.com/golang-jwt/jwt/v5"
)

var (
	ErrInvalidToken = errors.New("invalid token")
	ErrExpiredToken = errors.New("token expired")
)

type Claims struct {
	UserID    uint     `json:"uid"`
	Username  string   `json:"username"`
	Roles     []string `json:"roles"`
	SessionID string   `json:"sid"`
	ClientID  string   `json:"cid"`
	Purpose   string   `json:"purpose,omitempty"`
	gojwt.RegisteredClaims
}

type Service struct {
	secret          []byte
	accessTokenTTL  time.Duration
	refreshTokenTTL time.Duration
}

func NewService(secret string, accessTTL, refreshTTL time.Duration) *Service {
	return &Service{
		secret:          []byte(secret),
		accessTokenTTL:  accessTTL,
		refreshTokenTTL: refreshTTL,
	}
}

func (s *Service) GenerateAccessToken(userID uint, username string, roles []string, sessionID, clientID string, audiences []string) (string, error) {
	claims := &Claims{
		UserID:    userID,
		Username:  username,
		Roles:     roles,
		SessionID: sessionID,
		ClientID:  clientID,
		RegisteredClaims: gojwt.RegisteredClaims{
			ExpiresAt: gojwt.NewNumericDate(time.Now().Add(s.accessTokenTTL)),
			IssuedAt:  gojwt.NewNumericDate(time.Now()),
			Subject:   username,
			Audience:  audiences,
		},
	}
	token := gojwt.NewWithClaims(gojwt.SigningMethodHS256, claims)
	return token.SignedString(s.secret)
}

func (s *Service) GenerateRefreshToken(userID uint, username, sessionID, clientID string) (string, time.Time, error) {
	expiry := time.Now().Add(s.refreshTokenTTL)
	claims := &Claims{
		UserID:    userID,
		Username:  username,
		SessionID: sessionID,
		ClientID:  clientID,
		RegisteredClaims: gojwt.RegisteredClaims{
			ExpiresAt: gojwt.NewNumericDate(expiry),
			IssuedAt:  gojwt.NewNumericDate(time.Now()),
			Subject:   username,
		},
	}
	token := gojwt.NewWithClaims(gojwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.secret)
	return signed, expiry, err
}

func (s *Service) GenerateStepUpToken(userID uint, username, sessionID, clientID string, ttl time.Duration) (string, time.Time, error) {
	expiry := time.Now().Add(ttl)
	claims := &Claims{
		UserID:    userID,
		Username:  username,
		SessionID: sessionID,
		ClientID:  clientID,
		Purpose:   "step_up",
		RegisteredClaims: gojwt.RegisteredClaims{
			ExpiresAt: gojwt.NewNumericDate(expiry),
			IssuedAt:  gojwt.NewNumericDate(time.Now()),
			Subject:   username,
		},
	}
	token := gojwt.NewWithClaims(gojwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.secret)
	return signed, expiry, err
}

func (s *Service) ValidateToken(tokenStr string) (*Claims, error) {
	token, err := gojwt.ParseWithClaims(tokenStr, &Claims{}, func(t *gojwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*gojwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return s.secret, nil
	})
	if err != nil {
		if errors.Is(err, gojwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		return nil, ErrInvalidToken
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}
	return claims, nil
}

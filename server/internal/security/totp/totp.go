package totp

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"net/url"
	"strings"
	"time"
)

const (
	timeStep = 30
	digits   = 6
)

func GenerateSecret() (string, error) {
	buf := make([]byte, 20)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return strings.TrimRight(base32.StdEncoding.EncodeToString(buf), "="), nil
}

func BuildOTPAuthURL(issuer, account, secret string) string {
	label := url.QueryEscape(fmt.Sprintf("%s:%s", issuer, account))
	return fmt.Sprintf(
		"otpauth://totp/%s?secret=%s&issuer=%s&algorithm=SHA1&digits=%d&period=%d",
		label,
		url.QueryEscape(secret),
		url.QueryEscape(issuer),
		digits,
		timeStep,
	)
}

func ValidateCode(secret, code string, now time.Time) bool {
	if len(strings.TrimSpace(code)) != digits || strings.TrimSpace(secret) == "" {
		return false
	}
	for offset := -1; offset <= 1; offset++ {
		if generateCode(secret, timeCounter(now)+int64(offset)) == code {
			return true
		}
	}
	return false
}

func timeCounter(now time.Time) int64 {
	return now.Unix() / timeStep
}

func generateCode(secret string, counter int64) string {
	normalized := strings.ToUpper(strings.TrimSpace(secret))
	key, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(normalized)
	if err != nil {
		return ""
	}
	var msg [8]byte
	binary.BigEndian.PutUint64(msg[:], uint64(counter))
	mac := hmac.New(sha1.New, key)
	mac.Write(msg[:])
	sum := mac.Sum(nil)
	offset := sum[len(sum)-1] & 0x0f
	binCode := int(binary.BigEndian.Uint32(sum[offset:offset+4]) & 0x7fffffff)
	return fmt.Sprintf("%06d", binCode%1000000)
}

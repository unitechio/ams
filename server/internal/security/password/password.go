package password

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"golang.org/x/crypto/argon2"
	"golang.org/x/crypto/bcrypt"
)

const (
	argonTime    uint32 = 3
	argonMemory  uint32 = 64 * 1024
	argonThreads uint8  = 2
	argonKeyLen  uint32 = 32
	saltLen             = 16
)

func Hash(plain string) (string, error) {
	salt := make([]byte, saltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	hash := argon2.IDKey([]byte(plain), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
	return fmt.Sprintf(
		"$argon2id$v=19$m=%d,t=%d,p=%d$%s$%s",
		argonMemory,
		argonTime,
		argonThreads,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(hash),
	), nil
}

func Verify(encodedHash, plain string) (bool, bool, error) {
	if strings.HasPrefix(encodedHash, "$2") {
		err := bcrypt.CompareHashAndPassword([]byte(encodedHash), []byte(plain))
		if err == nil {
			return true, true, nil
		}
		if errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
			return false, true, nil
		}
		return false, true, err
	}
	if !strings.HasPrefix(encodedHash, "$argon2id$") {
		return false, false, errors.New("unsupported password hash format")
	}

	parts := strings.Split(encodedHash, "$")
	if len(parts) != 6 {
		return false, false, errors.New("invalid argon2id hash format")
	}

	var memory uint32
	var timeCost uint32
	var threads uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &timeCost, &threads); err != nil {
		return false, false, err
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false, false, err
	}
	expected, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return false, false, err
	}

	actual := argon2.IDKey([]byte(plain), salt, timeCost, memory, threads, uint32(len(expected)))
	return subtle.ConstantTimeCompare(expected, actual) == 1, false, nil
}

func ParseNeedsRehash(encodedHash string) bool {
	if strings.HasPrefix(encodedHash, "$2") {
		return true
	}
	if !strings.HasPrefix(encodedHash, "$argon2id$") {
		return true
	}
	parts := strings.Split(encodedHash, "$")
	if len(parts) != 6 {
		return true
	}
	params := strings.Split(parts[3], ",")
	if len(params) != 3 {
		return true
	}
	values := map[string]int{}
	for _, param := range params {
		kv := strings.SplitN(param, "=", 2)
		if len(kv) != 2 {
			return true
		}
		v, err := strconv.Atoi(kv[1])
		if err != nil {
			return true
		}
		values[kv[0]] = v
	}
	return values["m"] != int(argonMemory) || values["t"] != int(argonTime) || values["p"] != int(argonThreads)
}

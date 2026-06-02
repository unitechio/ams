package config

import (
	"os"
	"strconv"
	"strings"
	"time"
	"github.com/joho/godotenv"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Redis    RedisConfig
	JWT      JWTConfig
}

type ServerConfig struct {
	Host               string
	Port               string
	Env                string
	PublicURL          string
	Timezone           string
	AllowOrigins       []string
	ShutdownTimeout    time.Duration
	ReadHeaderTimeout  time.Duration
	ReadTimeout        time.Duration
	WriteTimeout       time.Duration
	IdleTimeout        time.Duration
	EnableMetrics      bool
	EnablePprof        bool
	EnableSecurityHead bool
	ContentSecurity    string
}

type DatabaseConfig struct {
	DSN             string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
	ConnMaxIdleTime time.Duration
}

type RedisConfig struct {
	Addr     string
	Password string
	DB       int
}

type JWTConfig struct {
	Secret          string
	Issuer          string
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration
}

func LoadConfig() (*Config, error) {
	env := os.Getenv("APP_ENV")
	if env == "" {
		env = "dev"
	}
	
	// Try loading environment specific file, then fallback to .env
	_ = godotenv.Load(".env." + env)
	_ = godotenv.Load(".env")

	defaultDSN := getEnv(
		"DB_DSN",
		"host=localhost port=5433 user=einfra password=einfra123 dbname=demo sslmode=disable TimeZone=Asia/Ho_Chi_Minh",
	)
	publicURL := getEnv("PUBLIC_URL", "")
	if publicURL == "" {
		publicURL = "http://localhost:" + getEnv("PORT", "8080")
	}

	config := &Config{
		Server: ServerConfig{
			Host:               getEnv("HOST", "0.0.0.0"),
			Port:               getEnv("PORT", "8080"),
			Env:                getEnv("ENV", "development"),
			PublicURL:          publicURL,
			Timezone:           getEnv("TZ", "Asia/Ho_Chi_Minh"),
			AllowOrigins:       getEnvList("CORS_ALLOW_ORIGINS", []string{"http://localhost:5173", "http://localhost:3000"}),
			ShutdownTimeout:    getEnvDuration("SHUTDOWN_TIMEOUT", 20*time.Second),
			ReadHeaderTimeout:  getEnvDuration("HTTP_READ_HEADER_TIMEOUT", 5*time.Second),
			ReadTimeout:        getEnvDuration("HTTP_READ_TIMEOUT", 15*time.Second),
			WriteTimeout:       getEnvDuration("HTTP_WRITE_TIMEOUT", 30*time.Second),
			IdleTimeout:        getEnvDuration("HTTP_IDLE_TIMEOUT", 60*time.Second),
			EnableMetrics:      getEnvBool("ENABLE_METRICS", true),
			EnablePprof:        getEnvBool("ENABLE_PPROF", false),
			EnableSecurityHead: getEnvBool("ENABLE_SECURITY_HEADERS", true),
			ContentSecurity: getEnv("CONTENT_SECURITY_POLICY",
				"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"),
		},
		Database: DatabaseConfig{
			DSN:             defaultDSN,
			MaxOpenConns:    getEnvInt("DB_MAX_OPEN_CONNS", 25),
			MaxIdleConns:    getEnvInt("DB_MAX_IDLE_CONNS", 5),
			ConnMaxLifetime: getEnvDuration("DB_CONN_MAX_LIFETIME", 30*time.Minute),
			ConnMaxIdleTime: getEnvDuration("DB_CONN_MAX_IDLE_TIME", 15*time.Minute),
		},
		Redis: RedisConfig{
			Addr:     getEnv("REDIS_ADDR", ""),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       getEnvInt("REDIS_DB", 0),
		},
		JWT: JWTConfig{
			Secret:          getEnv("JWT_SECRET", "super-secret-key-change-in-production"),
			Issuer:          getEnv("JWT_ISSUER", "ams-auth-server"),
			AccessTokenTTL:  getEnvDuration("JWT_ACCESS_TTL", 15*time.Minute),
			RefreshTokenTTL: getEnvDuration("JWT_REFRESH_TTL", 7*24*time.Hour),
		},
	}

	return config, nil
}

func getEnv(key, defaultVal string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return defaultVal
}

func getEnvBool(key string, defaultVal bool) bool {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return defaultVal
	}
	parsed, err := strconv.ParseBool(v)
	if err != nil {
		return defaultVal
	}
	return parsed
}

func getEnvInt(key string, defaultVal int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return defaultVal
	}
	parsed, err := strconv.Atoi(v)
	if err != nil {
		return defaultVal
	}
	return parsed
}

func getEnvDuration(key string, defaultVal time.Duration) time.Duration {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return defaultVal
	}
	parsed, err := time.ParseDuration(v)
	if err != nil {
		return defaultVal
	}
	return parsed
}

func getEnvList(key string, defaults []string) []string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return defaults
	}
	parts := strings.Split(v, ",")
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			items = append(items, part)
		}
	}
	if len(items) == 0 {
		return defaults
	}
	return items
}

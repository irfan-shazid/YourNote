// Package config loads and validates every setting the API needs, once, at boot.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// Config is the fully resolved runtime configuration.
type Config struct {
	Env             string
	Port            string
	DatabaseURL     string
	AuthSecret      string
	AllowedOrigins  []string
	StrictCookieSig bool
	RequestTimeout  time.Duration
	RateLimit       RateLimit
	Cloudinary      Cloudinary
}

// RateLimit bounds how many requests a single client may make per window.
type RateLimit struct {
	Requests int
	Window   time.Duration
}

// Cloudinary holds the credentials used to sign uploads and destroy assets.
type Cloudinary struct {
	CloudName string
	APIKey    string
	APISecret string
	Folder    string
}

// Configured reports whether Cloudinary credentials are present.
func (c Cloudinary) Configured() bool {
	return c.CloudName != "" && c.APIKey != "" && c.APISecret != ""
}

// IsProduction reports whether the API is running in production mode.
func (c Config) IsProduction() bool { return c.Env == "production" }

// Load reads configuration from .env (when present) and the environment.
// It fails fast: a missing required value is a startup error, never a runtime
// surprise halfway through a request.
func Load() (Config, error) {
	// A missing .env file is fine in production, where real env vars are used.
	_ = godotenv.Load(".env", "../../.env")

	cfg := Config{
		Env:             env("APP_ENV", "development"),
		Port:            env("PORT", "8080"),
		DatabaseURL:     os.Getenv("DATABASE_URL"),
		AuthSecret:      os.Getenv("BETTER_AUTH_SECRET"),
		AllowedOrigins:  splitAndTrim(env("ALLOWED_ORIGINS", "http://localhost:3000")),
		StrictCookieSig: envBool("AUTH_STRICT_COOKIE_SIGNATURE", false),
		RequestTimeout:  time.Duration(envInt("REQUEST_TIMEOUT_SECONDS", 30)) * time.Second,
		RateLimit: RateLimit{
			Requests: envInt("RATE_LIMIT_REQUESTS", 300),
			Window:   time.Duration(envInt("RATE_LIMIT_WINDOW_SECONDS", 60)) * time.Second,
		},
		Cloudinary: Cloudinary{
			CloudName: os.Getenv("CLOUDINARY_CLOUD_NAME"),
			APIKey:    os.Getenv("CLOUDINARY_API_KEY"),
			APISecret: os.Getenv("CLOUDINARY_API_SECRET"),
			Folder:    env("CLOUDINARY_FOLDER", "yournote"),
		},
	}

	var missing []string
	if cfg.DatabaseURL == "" {
		missing = append(missing, "DATABASE_URL")
	}
	if cfg.AuthSecret == "" {
		missing = append(missing, "BETTER_AUTH_SECRET")
	}
	if len(missing) > 0 {
		return Config{}, fmt.Errorf("missing required environment variables: %s", strings.Join(missing, ", "))
	}
	if cfg.StrictCookieSig && cfg.AuthSecret == "" {
		return Config{}, fmt.Errorf("AUTH_STRICT_COOKIE_SIGNATURE requires BETTER_AUTH_SECRET")
	}
	return cfg, nil
}

func env(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	v, err := strconv.Atoi(strings.TrimSpace(os.Getenv(key)))
	if err != nil || v <= 0 {
		return fallback
	}
	return v
}

func envBool(key string, fallback bool) bool {
	v, err := strconv.ParseBool(strings.TrimSpace(os.Getenv(key)))
	if err != nil {
		return fallback
	}
	return v
}

func splitAndTrim(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if trimmed := strings.TrimSpace(p); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

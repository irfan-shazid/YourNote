package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/yournote/api/internal/auth"
	"github.com/yournote/api/internal/httpx"
)

// RateLimiter is a fixed-window limiter keyed by user id, falling back to the
// client address for anonymous callers. It is in-process, which is the right
// trade-off for a single API instance; a shared store would be needed once the
// service is scaled horizontally.
type RateLimiter struct {
	mu       sync.Mutex
	counters map[string]*window
	limit    int
	window   time.Duration
}

type window struct {
	count   int
	resetAt time.Time
}

// NewRateLimiter builds a limiter allowing `limit` requests per window and
// starts a janitor that drops expired counters.
func NewRateLimiter(limit int, per time.Duration) *RateLimiter {
	limiter := &RateLimiter{
		counters: make(map[string]*window),
		limit:    limit,
		window:   per,
	}
	go limiter.cleanup()
	return limiter
}

// Middleware enforces the limit.
func (l *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := auth.UserIDFromContext(r.Context())
		if key == "" {
			key = httpx.ClientIP(r)
		}
		if !l.allow(key) {
			w.Header().Set("Retry-After", "60")
			httpx.Error(w, r, httpx.TooManyRequests("You are going a little fast. Try again in a moment."))
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (l *RateLimiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	current, exists := l.counters[key]
	if !exists || now.After(current.resetAt) {
		l.counters[key] = &window{count: 1, resetAt: now.Add(l.window)}
		return true
	}
	if current.count >= l.limit {
		return false
	}
	current.count++
	return true
}

func (l *RateLimiter) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()
		l.mu.Lock()
		for key, current := range l.counters {
			if now.After(current.resetAt) {
				delete(l.counters, key)
			}
		}
		l.mu.Unlock()
	}
}

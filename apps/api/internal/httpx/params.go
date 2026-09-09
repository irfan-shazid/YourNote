package httpx

import (
	"encoding/json"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"
)

const (
	defaultPageSize = 12
	maxPageSize     = 60
	maxBodyBytes    = 2 << 20 // 2 MiB is plenty for JSON payloads.
)

// Page reads the ?page= query parameter, clamped to sane bounds.
func Page(r *http.Request) int {
	page, err := strconv.Atoi(r.URL.Query().Get("page"))
	if err != nil || page < 1 {
		return 1
	}
	if page > 10000 {
		return 10000
	}
	return page
}

// PageSize reads the ?pageSize= query parameter, clamped to maxPageSize.
func PageSize(r *http.Request) int {
	size, err := strconv.Atoi(r.URL.Query().Get("pageSize"))
	if err != nil || size < 1 {
		return defaultPageSize
	}
	if size > maxPageSize {
		return maxPageSize
	}
	return size
}

// Query returns a trimmed query-string value.
func Query(r *http.Request, key string) string {
	return strings.TrimSpace(r.URL.Query().Get(key))
}

// QueryList splits a comma separated query parameter into trimmed values.
func QueryList(r *http.Request, key string) []string {
	raw := Query(r, key)
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

// DecodeJSON reads a JSON request body into dst, rejecting unknown fields and
// oversized payloads so malformed input fails loudly instead of silently.
func DecodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	if err := dec.Decode(dst); err != nil {
		return BadRequest("The request body is not valid JSON.").WithCause(err)
	}
	if err := dec.Decode(&struct{}{}); err != io.EOF {
		return BadRequest("The request body must contain a single JSON object.")
	}
	return nil
}

// ClientIP resolves the caller's address, preferring the proxy headers set by
// the platforms this API is normally deployed behind.
func ClientIP(r *http.Request) string {
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		if first, _, found := strings.Cut(forwarded, ","); found {
			return strings.TrimSpace(first)
		}
		return strings.TrimSpace(forwarded)
	}
	if real := r.Header.Get("X-Real-IP"); real != "" {
		return strings.TrimSpace(real)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

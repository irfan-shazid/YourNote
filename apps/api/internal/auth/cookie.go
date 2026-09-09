package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"net/url"
	"strings"
)

// Cookie names used by Better Auth. The __Secure- prefix is applied
// automatically when it runs behind HTTPS.
const (
	cookieName       = "better-auth.session_token"
	secureCookieName = "__Secure-better-auth.session_token"
)

// ExtractToken pulls the raw session token out of a request.
//
// Better Auth stores the cookie as "<token>.<hmac signature>"; only the token
// half is persisted in the sessions table. A Bearer token is also accepted so
// non-browser clients (and the Next.js server) can call the API directly.
func ExtractToken(r *http.Request) (token, signature string) {
	raw := ""
	if c, err := r.Cookie(secureCookieName); err == nil {
		raw = c.Value
	} else if c, err := r.Cookie(cookieName); err == nil {
		raw = c.Value
	} else if header := r.Header.Get("Authorization"); header != "" {
		if value, ok := strings.CutPrefix(header, "Bearer "); ok {
			raw = strings.TrimSpace(value)
		}
	}
	if raw == "" {
		return "", ""
	}
	// Cookie values arrive percent-encoded; decoding is best effort.
	if decoded, err := url.QueryUnescape(raw); err == nil {
		raw = decoded
	}
	if token, signature, found := strings.Cut(raw, "."); found {
		return token, signature
	}
	return raw, ""
}

// VerifySignature checks the HMAC-SHA256 signature Better Auth appends to the
// cookie value. The token itself is 32 bytes of CSPRNG output looked up in the
// database, so this is defence in depth rather than the primary control; it is
// enabled with AUTH_STRICT_COOKIE_SIGNATURE=true.
func VerifySignature(secret, token, signature string) bool {
	if signature == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(token))
	expected := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

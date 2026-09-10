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
// Better Auth stores the cookie as "<token>.<signature>", percent-encoded, and
// only the token half is persisted in the sessions table. Verified against a
// live Better Auth 1.7 sign-in:
//
//	cookie: JlJrU2FAI0QgK8S2f930qbIYJeDudFLJ.e886...f4Q%3D
//	token:  JlJrU2FAI0QgK8S2f930qbIYJeDudFLJ
//
// A Bearer token is also accepted so non-browser clients can call the API.
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

	// PathUnescape rather than QueryUnescape: the signature is base64, and
	// QueryUnescape would turn any literal '+' in it into a space.
	if decoded, err := url.PathUnescape(raw); err == nil {
		raw = decoded
	}

	if token, signature, found := strings.Cut(raw, "."); found {
		return token, signature
	}
	return raw, ""
}

// VerifySignature checks the HMAC-SHA256 signature Better Auth appends to the
// cookie value.
//
// Better Auth 1.7 encodes that HMAC as standard base64 with padding. Earlier
// releases used unpadded base64url, so both encodings are accepted: each is
// compared in constant time, and accepting a second encoding of the same HMAC
// weakens nothing.
//
// This is defence in depth rather than the primary control - the token itself
// is CSPRNG output looked up in the database - and is enabled with
// AUTH_STRICT_COOKIE_SIGNATURE=true.
func VerifySignature(secret, token, signature string) bool {
	if signature == "" || secret == "" {
		return false
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(token))
	sum := mac.Sum(nil)

	standard := base64.StdEncoding.EncodeToString(sum)
	urlSafe := base64.RawURLEncoding.EncodeToString(sum)

	return hmac.Equal([]byte(standard), []byte(signature)) ||
		hmac.Equal([]byte(urlSafe), []byte(signature))
}

// Package middleware wires cross-cutting concerns into the request pipeline:
// identity resolution, authorisation gates, logging, panic recovery and rate
// limiting.
package middleware

import (
	"log"
	"net/http"

	"github.com/yournote/api/internal/auth"
	"github.com/yournote/api/internal/httpx"
	"github.com/yournote/api/internal/repository"
)

// Authenticator resolves Better Auth session cookies into request identities.
type Authenticator struct {
	sessions *repository.SessionRepository
	secret   string
	strict   bool
}

// NewAuthenticator builds an Authenticator. When strict is true the HMAC
// signature on the session cookie must also verify, on top of the database
// lookup of the opaque token.
func NewAuthenticator(sessions *repository.SessionRepository, secret string, strict bool) *Authenticator {
	return &Authenticator{sessions: sessions, secret: secret, strict: strict}
}

// Resolve attaches the caller's identity when a valid session is present, and
// otherwise lets the request continue anonymously. Endpoints decide for
// themselves whether anonymous access is acceptable.
func (a *Authenticator) Resolve(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, signature := auth.ExtractToken(r)
		if token == "" {
			next.ServeHTTP(w, r)
			return
		}
		if a.strict && !auth.VerifySignature(a.secret, token, signature) {
			log.Printf("auth: rejected session cookie with an invalid signature")
			next.ServeHTTP(w, r)
			return
		}

		identity, err := a.sessions.FindIdentityByToken(r.Context(), token)
		if err != nil {
			// A database hiccup must not silently downgrade the caller to
			// anonymous on a write path, so this is a hard failure.
			httpx.Error(w, r, httpx.Internal(err))
			return
		}
		if identity == nil {
			next.ServeHTTP(w, r)
			return
		}

		next.ServeHTTP(w, r.WithContext(auth.WithIdentity(r.Context(), identity)))
	})
}

// RequireUser rejects anonymous callers, and blocks accounts that are banned.
func RequireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		identity := auth.FromContext(r.Context())
		if identity == nil {
			httpx.Error(w, r, httpx.Unauthorized("Sign in to continue."))
			return
		}
		if !identity.IsActive() {
			message := "Your account has been suspended."
			if identity.BanReason != nil && *identity.BanReason != "" {
				message = "Your account has been suspended: " + *identity.BanReason
			}
			httpx.Error(w, r, httpx.Forbidden(message))
			return
		}
		next.ServeHTTP(w, r)
	})
}

// RequireVerified additionally demands a verified email address. Google sign-in
// satisfies this on the first login because the provider vouches for the
// address, so only unverified password accounts are stopped here.
func RequireVerified(next http.Handler) http.Handler {
	return RequireUser(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if identity := auth.FromContext(r.Context()); !identity.EmailVerified {
			httpx.Error(w, r, httpx.Forbidden("Verify your email address to continue."))
			return
		}
		next.ServeHTTP(w, r)
	}))
}

// RequireAdmin restricts a route to admins.
func RequireAdmin(next http.Handler) http.Handler {
	return RequireUser(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !auth.FromContext(r.Context()).IsAdmin() {
			httpx.Error(w, r, httpx.Forbidden("Admins only."))
			return
		}
		next.ServeHTTP(w, r)
	}))
}

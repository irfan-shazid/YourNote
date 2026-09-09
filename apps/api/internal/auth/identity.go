// Package auth turns a Better Auth session cookie into a request identity.
//
// Better Auth (TypeScript) owns sign-in, OAuth and email verification; it
// persists sessions in the same Postgres database this API talks to. The Go
// service therefore never needs to reimplement auth - it resolves the opaque
// session token against the sessions table and authorises from there.
package auth

import (
	"context"
	"time"
)

// Role values mirror the Better Auth admin plugin.
const (
	RoleUser  = "user"
	RoleAdmin = "admin"
)

// Identity is the authenticated user attached to a request.
type Identity struct {
	UserID        string     `json:"id"`
	Name          string     `json:"name"`
	Email         string     `json:"email"`
	Image         *string    `json:"image"`
	Bio           *string    `json:"bio"`
	Role          string     `json:"role"`
	EmailVerified bool       `json:"emailVerified"`
	Banned        bool       `json:"banned"`
	BanReason     *string    `json:"banReason,omitempty"`
	BanExpires    *time.Time `json:"banExpires,omitempty"`
	SessionID     string     `json:"-"`
}

// IsAdmin reports whether the identity may use admin-only endpoints.
func (i *Identity) IsAdmin() bool { return i != nil && i.Role == RoleAdmin }

// IsActive reports whether the account is usable right now: a ban that has an
// expiry in the past no longer blocks the user.
func (i *Identity) IsActive() bool {
	if i == nil {
		return false
	}
	if !i.Banned {
		return true
	}
	return i.BanExpires != nil && i.BanExpires.Before(time.Now())
}

// Owns reports whether the identity owns the given resource, or is an admin.
func (i *Identity) Owns(ownerID string) bool {
	if i == nil {
		return false
	}
	return i.UserID == ownerID || i.IsAdmin()
}

type contextKey struct{}

var identityKey contextKey

// WithIdentity stores the resolved identity on the request context.
func WithIdentity(ctx context.Context, identity *Identity) context.Context {
	return context.WithValue(ctx, identityKey, identity)
}

// FromContext returns the identity attached to ctx, or nil when anonymous.
func FromContext(ctx context.Context) *Identity {
	identity, _ := ctx.Value(identityKey).(*Identity)
	return identity
}

// UserIDFromContext returns the current user id, or "" when anonymous.
func UserIDFromContext(ctx context.Context) string {
	if identity := FromContext(ctx); identity != nil {
		return identity.UserID
	}
	return ""
}

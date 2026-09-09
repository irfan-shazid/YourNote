// Package repository holds every SQL statement in the service. Handlers and
// services never build SQL themselves, so the database surface stays auditable
// in one place.
package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yournote/api/internal/auth"
)

// SessionRepository resolves Better Auth sessions.
type SessionRepository struct {
	db *pgxpool.Pool
}

// NewSessionRepository builds a SessionRepository.
func NewSessionRepository(db *pgxpool.Pool) *SessionRepository {
	return &SessionRepository{db: db}
}

const identityByTokenSQL = `
	SELECT u.id,
	       u.name,
	       u.email,
	       u.image,
	       u.bio,
	       COALESCE(u.role, 'user'),
	       u.email_verified,
	       COALESCE(u.banned, false),
	       u.ban_reason,
	       u.ban_expires,
	       s.id
	FROM sessions s
	JOIN users u ON u.id = s.user_id
	WHERE s.token = $1
	  AND s.expires_at > now()`

// FindIdentityByToken resolves a session token to the user behind it.
// An unknown or expired token returns (nil, nil): that is an anonymous
// request, not an error.
func (r *SessionRepository) FindIdentityByToken(ctx context.Context, token string) (*auth.Identity, error) {
	var identity auth.Identity

	err := r.db.QueryRow(ctx, identityByTokenSQL, token).Scan(
		&identity.UserID,
		&identity.Name,
		&identity.Email,
		&identity.Image,
		&identity.Bio,
		&identity.Role,
		&identity.EmailVerified,
		&identity.Banned,
		&identity.BanReason,
		&identity.BanExpires,
		&identity.SessionID,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find identity by token: %w", err)
	}
	return &identity, nil
}

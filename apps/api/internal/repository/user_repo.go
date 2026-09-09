package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yournote/api/internal/models"
)

// UserRepository reads and writes the profile fields a user owns.
type UserRepository struct {
	db *pgxpool.Pool
}

// NewUserRepository builds a UserRepository.
func NewUserRepository(db *pgxpool.Pool) *UserRepository {
	return &UserRepository{db: db}
}

// Profile loads a public author page with their aggregate stats. Only
// published public notes contribute to the counters.
func (r *UserRepository) Profile(ctx context.Context, userID string) (*models.Profile, error) {
	var profile models.Profile

	err := r.db.QueryRow(ctx, `
		SELECT u.id,
		       u.name,
		       u.image,
		       u.bio,
		       COALESCE(u.role, 'user'),
		       u.created_at,
		       (SELECT count(*) FROM notes n
		         WHERE n.author_id = u.id AND n.status = 'published' AND n.visibility = 'public'),
		       (SELECT count(*) FROM reactions r
		          JOIN notes n ON n.id = r.note_id
		         WHERE n.author_id = u.id),
		       (SELECT COALESCE(sum(n.view_count), 0) FROM notes n WHERE n.author_id = u.id)
		FROM users u
		WHERE u.id = $1`, userID,
	).Scan(
		&profile.ID, &profile.Name, &profile.Image, &profile.Bio, &profile.Role,
		&profile.CreatedAt, &profile.NoteCount, &profile.Reactions, &profile.Views,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("load profile: %w", err)
	}
	return &profile, nil
}

// UpdateProfile saves the name and bio a user set on themselves.
func (r *UserRepository) UpdateProfile(ctx context.Context, userID, name string, bio *string) error {
	tag, err := r.db.Exec(ctx,
		"UPDATE users SET name = $2, bio = $3, updated_at = now() WHERE id = $1",
		userID, name, bio)
	if err != nil {
		return fmt.Errorf("update profile: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

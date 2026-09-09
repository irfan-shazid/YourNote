package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// BookmarkRepository stores the notes a user saved for later.
type BookmarkRepository struct {
	db *pgxpool.Pool
}

// NewBookmarkRepository builds a BookmarkRepository.
func NewBookmarkRepository(db *pgxpool.Pool) *BookmarkRepository {
	return &BookmarkRepository{db: db}
}

// Toggle saves or unsaves a note and reports the resulting state.
func (r *BookmarkRepository) Toggle(ctx context.Context, id, noteID, userID string) (bool, error) {
	tag, err := r.db.Exec(ctx,
		"DELETE FROM bookmarks WHERE note_id = $1 AND user_id = $2", noteID, userID)
	if err != nil {
		return false, fmt.Errorf("remove bookmark: %w", err)
	}
	if tag.RowsAffected() > 0 {
		return false, nil
	}

	_, err = r.db.Exec(ctx, `
		INSERT INTO bookmarks (id, note_id, user_id, created_at)
		VALUES ($1, $2, $3, now())
		ON CONFLICT (note_id, user_id) DO NOTHING`,
		id, noteID, userID)
	if err != nil {
		return false, fmt.Errorf("add bookmark: %w", err)
	}
	return true, nil
}

// Count returns how many people saved a note.
func (r *BookmarkRepository) Count(ctx context.Context, noteID string) (int, error) {
	var total int
	if err := r.db.QueryRow(ctx,
		"SELECT count(*) FROM bookmarks WHERE note_id = $1", noteID).Scan(&total); err != nil {
		return 0, fmt.Errorf("count bookmarks: %w", err)
	}
	return total, nil
}

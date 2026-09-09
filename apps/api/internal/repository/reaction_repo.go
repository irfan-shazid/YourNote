package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yournote/api/internal/models"
)

// ReactionRepository stores the emoji reactions on notes.
type ReactionRepository struct {
	db *pgxpool.Pool
}

// NewReactionRepository builds a ReactionRepository.
func NewReactionRepository(db *pgxpool.Pool) *ReactionRepository {
	return &ReactionRepository{db: db}
}

// Toggle adds a reaction, or removes it when the user already reacted that way.
// It reports whether the reaction is now active.
func (r *ReactionRepository) Toggle(ctx context.Context, id, noteID, userID, reactionType string) (bool, error) {
	tag, err := r.db.Exec(ctx,
		"DELETE FROM reactions WHERE note_id = $1 AND user_id = $2 AND type = $3",
		noteID, userID, reactionType)
	if err != nil {
		return false, fmt.Errorf("remove reaction: %w", err)
	}
	if tag.RowsAffected() > 0 {
		return false, nil
	}

	_, err = r.db.Exec(ctx, `
		INSERT INTO reactions (id, note_id, user_id, type, created_at)
		VALUES ($1, $2, $3, $4, now())
		ON CONFLICT (note_id, user_id, type) DO NOTHING`,
		id, noteID, userID, reactionType)
	if err != nil {
		return false, fmt.Errorf("add reaction: %w", err)
	}
	return true, nil
}

// Summary returns the per-type counts for a note and the types the viewer used.
func (r *ReactionRepository) Summary(ctx context.Context, noteID, viewerID string) (map[string]int, []string, int, error) {
	rows, err := r.db.Query(ctx,
		"SELECT type, count(*) FROM reactions WHERE note_id = $1 GROUP BY type", noteID)
	if err != nil {
		return nil, nil, 0, fmt.Errorf("count reactions: %w", err)
	}
	defer rows.Close()

	counts := make(map[string]int, len(models.ReactionTypes))
	total := 0
	for rows.Next() {
		var (
			reactionType string
			count        int
		)
		if err := rows.Scan(&reactionType, &count); err != nil {
			return nil, nil, 0, fmt.Errorf("scan reaction count: %w", err)
		}
		counts[reactionType] = count
		total += count
	}
	if err := rows.Err(); err != nil {
		return nil, nil, 0, err
	}

	viewer := []string{}
	if viewerID != "" {
		viewerRows, err := r.db.Query(ctx,
			"SELECT type FROM reactions WHERE note_id = $1 AND user_id = $2 ORDER BY type",
			noteID, viewerID)
		if err != nil {
			return nil, nil, 0, fmt.Errorf("load viewer reactions: %w", err)
		}
		defer viewerRows.Close()

		for viewerRows.Next() {
			var reactionType string
			if err := viewerRows.Scan(&reactionType); err != nil {
				return nil, nil, 0, fmt.Errorf("scan viewer reaction: %w", err)
			}
			viewer = append(viewer, reactionType)
		}
		if err := viewerRows.Err(); err != nil {
			return nil, nil, 0, err
		}
	}
	return counts, viewer, total, nil
}

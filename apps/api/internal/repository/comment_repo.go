package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yournote/api/internal/models"
)

// CommentRepository reads and writes note discussions.
type CommentRepository struct {
	db *pgxpool.Pool
}

// NewCommentRepository builds a CommentRepository.
func NewCommentRepository(db *pgxpool.Pool) *CommentRepository {
	return &CommentRepository{db: db}
}

const commentColumns = `
	c.id, c.note_id, c.parent_id, c.content, c.is_deleted, c.created_at, c.updated_at,
	u.id, u.name, u.image, COALESCE(u.role, 'user')`

func scanComment(row pgx.Row) (models.Comment, error) {
	var c models.Comment
	err := row.Scan(
		&c.ID, &c.NoteID, &c.ParentID, &c.Content, &c.IsDeleted, &c.CreatedAt, &c.UpdatedAt,
		&c.Author.ID, &c.Author.Name, &c.Author.Image, &c.Author.Role,
	)
	if err != nil {
		return models.Comment{}, err
	}
	c.Replies = []models.Comment{}
	return c, nil
}

// ListByNote returns the full discussion for a note as a two-level tree:
// top-level comments in chronological order, each with its replies.
func (r *CommentRepository) ListByNote(ctx context.Context, noteID string) ([]models.Comment, error) {
	query := "SELECT " + commentColumns + `
		FROM comments c
		JOIN users u ON u.id = c.author_id
		WHERE c.note_id = $1
		ORDER BY c.created_at ASC`

	rows, err := r.db.Query(ctx, query, noteID)
	if err != nil {
		return nil, fmt.Errorf("list comments: %w", err)
	}
	defer rows.Close()

	var flat []models.Comment
	for rows.Next() {
		comment, err := scanComment(rows)
		if err != nil {
			return nil, fmt.Errorf("scan comment: %w", err)
		}
		flat = append(flat, comment)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate comments: %w", err)
	}

	return buildTree(flat), nil
}

// buildTree nests replies under their parent, keeping chronological order.
// A reply whose parent is missing is promoted to the top level so no comment
// can silently disappear.
func buildTree(flat []models.Comment) []models.Comment {
	roots := make([]models.Comment, 0, len(flat))
	index := make(map[string]int, len(flat))

	for _, comment := range flat {
		if comment.ParentID == nil {
			index[comment.ID] = len(roots)
			roots = append(roots, comment)
		}
	}
	for _, comment := range flat {
		if comment.ParentID == nil {
			continue
		}
		if position, ok := index[*comment.ParentID]; ok {
			roots[position].Replies = append(roots[position].Replies, comment)
			continue
		}
		roots = append(roots, comment)
	}
	return roots
}

// CountByNote returns the number of visible comments on a note.
func (r *CommentRepository) CountByNote(ctx context.Context, noteID string) (int, error) {
	var total int
	err := r.db.QueryRow(ctx,
		"SELECT count(*) FROM comments WHERE note_id = $1 AND is_deleted = false", noteID,
	).Scan(&total)
	if err != nil {
		return 0, fmt.Errorf("count comments: %w", err)
	}
	return total, nil
}

// Create inserts a comment and returns it, hydrated with its author.
func (r *CommentRepository) Create(ctx context.Context, id, noteID, authorID string, parentID *string, content string) (*models.Comment, error) {
	_, err := r.db.Exec(ctx, `
		INSERT INTO comments (id, note_id, author_id, parent_id, content, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, now(), now())`,
		id, noteID, authorID, parentID, content,
	)
	if err != nil {
		return nil, fmt.Errorf("insert comment: %w", err)
	}
	return r.GetByID(ctx, id)
}

// GetByID loads a single comment with its author.
func (r *CommentRepository) GetByID(ctx context.Context, id string) (*models.Comment, error) {
	query := "SELECT " + commentColumns + `
		FROM comments c
		JOIN users u ON u.id = c.author_id
		WHERE c.id = $1`

	comment, err := scanComment(r.db.QueryRow(ctx, query, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get comment: %w", err)
	}
	return &comment, nil
}

// Update edits the body of a comment.
func (r *CommentRepository) Update(ctx context.Context, id, content string) error {
	tag, err := r.db.Exec(ctx,
		"UPDATE comments SET content = $2, updated_at = now() WHERE id = $1 AND is_deleted = false",
		id, content)
	if err != nil {
		return fmt.Errorf("update comment: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// SoftDelete hides a comment while preserving the thread it belongs to. The
// moderator and their reason are kept for the audit trail.
func (r *CommentRepository) SoftDelete(ctx context.Context, id, deletedBy string, reason *string) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE comments
		SET is_deleted = true, deleted_by_id = $2, deleted_reason = $3,
		    deleted_at = now(), updated_at = now()
		WHERE id = $1 AND is_deleted = false`,
		id, deletedBy, reason,
	)
	if err != nil {
		return fmt.Errorf("soft delete comment: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// Restore brings a removed comment back.
func (r *CommentRepository) Restore(ctx context.Context, id string) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE comments
		SET is_deleted = false, deleted_by_id = NULL, deleted_reason = NULL,
		    deleted_at = NULL, updated_at = now()
		WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("restore comment: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// HardDelete removes a comment and its replies for good.
func (r *CommentRepository) HardDelete(ctx context.Context, id string) error {
	tag, err := r.db.Exec(ctx, "DELETE FROM comments WHERE id = $1", id)
	if err != nil {
		return fmt.Errorf("delete comment: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// AdminCommentFilter pages the moderation queue.
type AdminCommentFilter struct {
	Search   string
	Status   string // all | visible | removed
	NoteID   string
	AuthorID string
	Page     int
	PageSize int
}

// ListForModeration returns comments with the note they belong to, newest
// first, so an admin can review and remove them in context.
func (r *CommentRepository) ListForModeration(ctx context.Context, f AdminCommentFilter) ([]models.AdminComment, int, error) {
	var (
		where []string
		args  []any
	)
	next := func(value any) string {
		args = append(args, value)
		return fmt.Sprintf("$%d", len(args))
	}

	switch f.Status {
	case "removed":
		where = append(where, "c.is_deleted = true")
	case "visible":
		where = append(where, "c.is_deleted = false")
	}
	if f.NoteID != "" {
		where = append(where, "c.note_id = "+next(f.NoteID))
	}
	if f.AuthorID != "" {
		where = append(where, "c.author_id = "+next(f.AuthorID))
	}
	if f.Search != "" {
		pattern := next("%" + f.Search + "%")
		where = append(where, fmt.Sprintf("(c.content ILIKE %[1]s OR u.name ILIKE %[1]s OR u.email ILIKE %[1]s OR n.title ILIKE %[1]s)", pattern))
	}

	clause := ""
	if len(where) > 0 {
		clause = " WHERE " + strings.Join(where, " AND ")
	}

	from := `
		FROM comments c
		JOIN users u ON u.id = c.author_id
		JOIN notes n ON n.id = c.note_id` + clause

	var total int
	if err := r.db.QueryRow(ctx, "SELECT count(*)"+from, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count moderation comments: %w", err)
	}
	if total == 0 {
		return []models.AdminComment{}, 0, nil
	}

	query := fmt.Sprintf(
		"SELECT %s, n.title, n.slug %s ORDER BY c.created_at DESC LIMIT $%d OFFSET $%d",
		commentColumns, from, len(args)+1, len(args)+2,
	)
	args = append(args, f.PageSize, (f.Page-1)*f.PageSize)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list moderation comments: %w", err)
	}
	defer rows.Close()

	items := make([]models.AdminComment, 0, f.PageSize)
	for rows.Next() {
		var item models.AdminComment
		err := rows.Scan(
			&item.ID, &item.NoteID, &item.ParentID, &item.Content, &item.IsDeleted,
			&item.CreatedAt, &item.UpdatedAt,
			&item.Author.ID, &item.Author.Name, &item.Author.Image, &item.Author.Role,
			&item.NoteTitle, &item.NoteSlug,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scan moderation comment: %w", err)
		}
		item.Replies = []models.Comment{}
		item.CanDelete = true
		items = append(items, item)
	}
	return items, total, rows.Err()
}

// ContentPreview returns a short excerpt of a comment, used by the report queue.
func (r *CommentRepository) ContentPreview(ctx context.Context, id string) (string, error) {
	var content string
	err := r.db.QueryRow(ctx, "SELECT content FROM comments WHERE id = $1", id).Scan(&content)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", fmt.Errorf("load comment preview: %w", err)
	}
	return content, nil
}

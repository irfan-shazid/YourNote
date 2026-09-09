package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yournote/api/internal/models"
)

// ErrNotFound is returned when a row does not exist or is not visible.
var ErrNotFound = errors.New("not found")

// NoteRepository reads and writes notes and their attachments.
type NoteRepository struct {
	db *pgxpool.Pool
}

// NewNoteRepository builds a NoteRepository.
func NewNoteRepository(db *pgxpool.Pool) *NoteRepository {
	return &NoteRepository{db: db}
}

// NoteFilter describes one page of a note listing. The scope flags are set by
// the service after it has checked who is asking - the repository trusts them.
type NoteFilter struct {
	Search       string
	Tag          string
	Subject      string
	AuthorID     string
	BookmarkedBy string
	Status       string
	Visibility   string
	Sort         string
	ViewerID     string

	// IncludeDrafts also returns drafts, IncludeRemoved also returns moderated
	// notes, IncludeNonPublic also returns unlisted and private notes.
	IncludeDrafts    bool
	IncludeRemoved   bool
	IncludeNonPublic bool

	Page     int
	PageSize int
}

// noteColumnsTemplate is the projection shared by the list and detail queries.
// %[1]s is the placeholder holding the viewer id ("" for anonymous readers).
const noteColumnsTemplate = `
	n.id,
	n.title,
	n.slug,
	n.summary,
	n.subject,
	n.tags,
	n.cover_image,
	n.visibility,
	n.status,
	n.view_count,
	n.created_at,
	n.updated_at,
	u.id,
	u.name,
	u.image,
	COALESCE(u.role, 'user'),
	(SELECT count(*) FROM comments c WHERE c.note_id = n.id AND c.is_deleted = false),
	(SELECT count(*) FROM reactions r WHERE r.note_id = n.id),
	(SELECT count(*) FROM bookmarks b WHERE b.note_id = n.id),
	COALESCE((
		SELECT json_object_agg(grouped.type, grouped.total)
		FROM (
			SELECT r.type, count(*) AS total
			FROM reactions r
			WHERE r.note_id = n.id
			GROUP BY r.type
		) grouped
	), '{}'::json),
	COALESCE((
		SELECT array_agg(r.type ORDER BY r.type)
		FROM reactions r
		WHERE r.note_id = n.id AND r.user_id = %[1]s
	), ARRAY[]::text[]),
	EXISTS (SELECT 1 FROM bookmarks b WHERE b.note_id = n.id AND b.user_id = %[1]s)`

// noteColumns renders the projection with the viewer id bound to the given
// placeholder. The placeholder is not fixed at $1 because the list query builds
// its filter arguments first and appends the viewer id after them.
func noteColumns(viewerPlaceholder string) string {
	return fmt.Sprintf(noteColumnsTemplate, viewerPlaceholder)
}

// scanNote reads one row of noteColumns. Content is filled in separately by
// the detail queries so list responses stay small.
func scanNote(row pgx.Row) (models.Note, error) {
	var (
		note           models.Note
		reactionCounts []byte
	)

	err := row.Scan(
		&note.ID,
		&note.Title,
		&note.Slug,
		&note.Summary,
		&note.Subject,
		&note.Tags,
		&note.CoverImage,
		&note.Visibility,
		&note.Status,
		&note.Stats.Views,
		&note.CreatedAt,
		&note.UpdatedAt,
		&note.Author.ID,
		&note.Author.Name,
		&note.Author.Image,
		&note.Author.Role,
		&note.Stats.Comments,
		&note.Stats.Reactions,
		&note.Stats.Bookmarks,
		&reactionCounts,
		&note.Viewer.Reactions,
		&note.Viewer.Bookmarked,
	)
	if err != nil {
		return models.Note{}, err
	}

	note.Stats.ReactionCounts = map[string]int{}
	if len(reactionCounts) > 0 {
		if err := json.Unmarshal(reactionCounts, &note.Stats.ReactionCounts); err != nil {
			return models.Note{}, fmt.Errorf("decode reaction counts: %w", err)
		}
	}
	if note.Tags == nil {
		note.Tags = []string{}
	}
	if note.Viewer.Reactions == nil {
		note.Viewer.Reactions = []string{}
	}
	note.Attachments = []models.Attachment{}
	return note, nil
}

// conditions turns a filter into a WHERE clause plus its arguments, numbered
// from $1. The viewer id is deliberately not included: the count query does not
// select viewer state, and Postgres rejects a statement that is handed a
// parameter it never references.
func (f NoteFilter) conditions() (string, []any) {
	var (
		args  []any
		where []string
	)

	next := func(value any) string {
		args = append(args, value)
		return fmt.Sprintf("$%d", len(args))
	}

	if !f.IncludeRemoved {
		where = append(where, "n.status <> 'removed'")
	}
	if !f.IncludeDrafts {
		where = append(where, "n.status = 'published'")
	}
	if !f.IncludeNonPublic {
		where = append(where, "n.visibility = 'public'")
	}
	if f.Status != "" {
		where = append(where, "n.status = "+next(f.Status))
	}
	if f.Visibility != "" {
		where = append(where, "n.visibility = "+next(f.Visibility))
	}
	if f.AuthorID != "" {
		where = append(where, "n.author_id = "+next(f.AuthorID))
	}
	if f.Subject != "" {
		where = append(where, "n.subject ILIKE "+next(f.Subject))
	}
	if f.Tag != "" {
		where = append(where, next(strings.ToLower(f.Tag))+" = ANY(n.tags)")
	}
	if f.BookmarkedBy != "" {
		where = append(where, "EXISTS (SELECT 1 FROM bookmarks b WHERE b.note_id = n.id AND b.user_id = "+next(f.BookmarkedBy)+")")
	}
	if f.Search != "" {
		pattern := next("%" + f.Search + "%")
		where = append(where, fmt.Sprintf(`(
			n.title ILIKE %[1]s
			OR n.summary ILIKE %[1]s
			OR n.subject ILIKE %[1]s
			OR n.content ILIKE %[1]s
			OR u.name ILIKE %[1]s
			OR EXISTS (SELECT 1 FROM unnest(n.tags) tag WHERE tag ILIKE %[1]s)
		)`, pattern))
	}

	if len(where) == 0 {
		return "", args
	}
	return " WHERE " + strings.Join(where, " AND "), args
}

// orderBy maps the public sort keys onto SQL. Unknown values fall back to the
// newest-first ordering.
func (f NoteFilter) orderBy() string {
	switch f.Sort {
	case "popular":
		return "ORDER BY (SELECT count(*) FROM reactions r WHERE r.note_id = n.id) DESC, n.created_at DESC"
	case "discussed":
		return "ORDER BY (SELECT count(*) FROM comments c WHERE c.note_id = n.id AND c.is_deleted = false) DESC, n.created_at DESC"
	case "views":
		return "ORDER BY n.view_count DESC, n.created_at DESC"
	case "oldest":
		return "ORDER BY n.created_at ASC"
	default:
		return "ORDER BY n.created_at DESC"
	}
}

const notesFrom = " FROM notes n JOIN users u ON u.id = n.author_id"

// countQuery builds the total-rows statement. It selects no viewer state, so it
// is handed only the filter arguments: passing a parameter the statement never
// references is an error in Postgres, not something it ignores.
func (f NoteFilter) countQuery() (string, []any) {
	where, args := f.conditions()
	return "SELECT count(*)" + notesFrom + where, args
}

// listQuery builds the page statement. The viewer id and the page window are
// appended after the filter arguments, so their placeholder numbers depend on
// how many filters were applied.
func (f NoteFilter) listQuery() (string, []any) {
	where, args := f.conditions()

	viewer := fmt.Sprintf("$%d", len(args)+1)
	query := fmt.Sprintf(
		"SELECT %s%s%s %s LIMIT $%d OFFSET $%d",
		noteColumns(viewer), notesFrom, where, f.orderBy(), len(args)+2, len(args)+3,
	)

	return query, append(args, f.ViewerID, f.PageSize, (f.Page-1)*f.PageSize)
}

// List returns one page of notes plus the total number of matching rows.
func (r *NoteRepository) List(ctx context.Context, f NoteFilter) ([]models.Note, int, error) {
	countSQL, countArgs := f.countQuery()

	var total int
	if err := r.db.QueryRow(ctx, countSQL, countArgs...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count notes: %w", err)
	}
	if total == 0 {
		return []models.Note{}, 0, nil
	}

	listSQL, args := f.listQuery()

	rows, err := r.db.Query(ctx, listSQL, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list notes: %w", err)
	}
	defer rows.Close()

	notes := make([]models.Note, 0, f.PageSize)
	for rows.Next() {
		note, err := scanNote(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scan note: %w", err)
		}
		notes = append(notes, note)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate notes: %w", err)
	}

	if err := r.attachAttachments(ctx, notes); err != nil {
		return nil, 0, err
	}
	return notes, total, nil
}

// find loads a single note by an arbitrary predicate on the notes table.
func (r *NoteRepository) find(ctx context.Context, predicate string, viewerID, value string) (*models.Note, error) {
	query := fmt.Sprintf(
		"SELECT %s, n.content FROM notes n JOIN users u ON u.id = n.author_id WHERE %s = $2",
		noteColumns("$1"), predicate,
	)

	row := r.db.QueryRow(ctx, query, viewerID, value)

	// The detail query appends content to the shared projection, so it is
	// scanned through a small wrapper that forwards the extra column.
	var (
		note           models.Note
		reactionCounts []byte
	)
	err := row.Scan(
		&note.ID, &note.Title, &note.Slug, &note.Summary, &note.Subject, &note.Tags,
		&note.CoverImage, &note.Visibility, &note.Status, &note.Stats.Views,
		&note.CreatedAt, &note.UpdatedAt,
		&note.Author.ID, &note.Author.Name, &note.Author.Image, &note.Author.Role,
		&note.Stats.Comments, &note.Stats.Reactions, &note.Stats.Bookmarks,
		&reactionCounts, &note.Viewer.Reactions, &note.Viewer.Bookmarked,
		&note.Content,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("find note: %w", err)
	}

	note.Stats.ReactionCounts = map[string]int{}
	if len(reactionCounts) > 0 {
		if err := json.Unmarshal(reactionCounts, &note.Stats.ReactionCounts); err != nil {
			return nil, fmt.Errorf("decode reaction counts: %w", err)
		}
	}
	if note.Tags == nil {
		note.Tags = []string{}
	}
	if note.Viewer.Reactions == nil {
		note.Viewer.Reactions = []string{}
	}

	attachments, err := r.attachmentsFor(ctx, []string{note.ID})
	if err != nil {
		return nil, err
	}
	note.Attachments = attachments[note.ID]
	if note.Attachments == nil {
		note.Attachments = []models.Attachment{}
	}
	return &note, nil
}

// GetByID loads a note by id, including its content and attachments.
func (r *NoteRepository) GetByID(ctx context.Context, id, viewerID string) (*models.Note, error) {
	return r.find(ctx, "n.id", viewerID, id)
}

// GetBySlug loads a note by slug, including its content and attachments.
func (r *NoteRepository) GetBySlug(ctx context.Context, slug, viewerID string) (*models.Note, error) {
	return r.find(ctx, "n.slug", viewerID, slug)
}

// AuthorOf returns the owner id and current status of a note.
func (r *NoteRepository) AuthorOf(ctx context.Context, noteID string) (authorID, status, visibility string, err error) {
	err = r.db.QueryRow(ctx,
		"SELECT author_id, status, visibility FROM notes WHERE id = $1", noteID,
	).Scan(&authorID, &status, &visibility)

	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", "", ErrNotFound
	}
	if err != nil {
		return "", "", "", fmt.Errorf("load note owner: %w", err)
	}
	return authorID, status, visibility, nil
}

// attachAttachments hydrates the attachment list of every note in one query,
// avoiding an N+1 when rendering a grid of note cards.
func (r *NoteRepository) attachAttachments(ctx context.Context, notes []models.Note) error {
	if len(notes) == 0 {
		return nil
	}
	ids := make([]string, len(notes))
	for i, note := range notes {
		ids[i] = note.ID
	}

	byNote, err := r.attachmentsFor(ctx, ids)
	if err != nil {
		return err
	}
	for i := range notes {
		if list, ok := byNote[notes[i].ID]; ok {
			notes[i].Attachments = list
		}
	}
	return nil
}

const attachmentColumns = `
	id, note_id, url, secure_url, public_id, resource_type, format,
	original_name, bytes, width, height, pages, position, created_at`

func (r *NoteRepository) attachmentsFor(ctx context.Context, noteIDs []string) (map[string][]models.Attachment, error) {
	query := "SELECT " + attachmentColumns + " FROM attachments WHERE note_id = ANY($1) ORDER BY position ASC, created_at ASC"

	rows, err := r.db.Query(ctx, query, noteIDs)
	if err != nil {
		return nil, fmt.Errorf("load attachments: %w", err)
	}
	defer rows.Close()

	result := make(map[string][]models.Attachment, len(noteIDs))
	for rows.Next() {
		var a models.Attachment
		if err := rows.Scan(
			&a.ID, &a.NoteID, &a.URL, &a.SecureURL, &a.PublicID, &a.ResourceType,
			&a.Format, &a.OriginalName, &a.Bytes, &a.Width, &a.Height, &a.Pages,
			&a.Position, &a.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan attachment: %w", err)
		}
		result[a.NoteID] = append(result[a.NoteID], a)
	}
	return result, rows.Err()
}

// NoteInsert carries the pre-generated identifiers a create needs.
type NoteInsert struct {
	ID       string
	Slug     string
	AuthorID string
	Request  models.NoteRequest
	// AttachmentIDs are pre-generated, one per request attachment.
	AttachmentIDs []string
}

// Create inserts a note and its attachments in a single transaction.
func (r *NoteRepository) Create(ctx context.Context, in NoteInsert) error {
	return r.inTx(ctx, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `
			INSERT INTO notes (id, title, slug, summary, content, subject, tags,
			                   cover_image, visibility, status, author_id,
			                   created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())`,
			in.ID, in.Request.Title, in.Slug, in.Request.Summary, in.Request.Content,
			in.Request.Subject, in.Request.Tags, in.Request.CoverImage,
			in.Request.Visibility, in.Request.Status, in.AuthorID,
		)
		if err != nil {
			return fmt.Errorf("insert note: %w", err)
		}
		return insertAttachments(ctx, tx, in.ID, in.AttachmentIDs, in.Request.Attachments)
	})
}

// Update replaces a note and its attachment set. Attachments are rewritten
// wholesale because the editor always submits the full list.
func (r *NoteRepository) Update(ctx context.Context, noteID string, attachmentIDs []string, req models.NoteRequest) error {
	return r.inTx(ctx, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
			UPDATE notes
			SET title = $2, summary = $3, content = $4, subject = $5, tags = $6,
			    cover_image = $7, visibility = $8, status = $9, updated_at = now()
			WHERE id = $1`,
			noteID, req.Title, req.Summary, req.Content, req.Subject, req.Tags,
			req.CoverImage, req.Visibility, req.Status,
		)
		if err != nil {
			return fmt.Errorf("update note: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return ErrNotFound
		}

		if _, err := tx.Exec(ctx, "DELETE FROM attachments WHERE note_id = $1", noteID); err != nil {
			return fmt.Errorf("clear attachments: %w", err)
		}
		return insertAttachments(ctx, tx, noteID, attachmentIDs, req.Attachments)
	})
}

func insertAttachments(ctx context.Context, tx pgx.Tx, noteID string, ids []string, items []models.AttachmentInput) error {
	for i, item := range items {
		if i >= len(ids) {
			return fmt.Errorf("missing generated id for attachment %d", i)
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO attachments (id, note_id, url, secure_url, public_id, resource_type,
			                         format, original_name, bytes, width, height, pages,
			                         position, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())`,
			ids[i], noteID, item.URL, item.SecureURL, item.PublicID, item.ResourceType,
			item.Format, item.OriginalName, item.Bytes, item.Width, item.Height,
			item.Pages, i,
		)
		if err != nil {
			return fmt.Errorf("insert attachment: %w", err)
		}
	}
	return nil
}

// Delete removes a note and returns the Cloudinary assets that are now orphaned
// so the caller can clean them up.
func (r *NoteRepository) Delete(ctx context.Context, noteID string) ([]models.Attachment, error) {
	assets, err := r.attachmentsFor(ctx, []string{noteID})
	if err != nil {
		return nil, err
	}

	tag, err := r.db.Exec(ctx, "DELETE FROM notes WHERE id = $1", noteID)
	if err != nil {
		return nil, fmt.Errorf("delete note: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return assets[noteID], nil
}

// SetStatus soft-removes or restores a note from the admin panel.
func (r *NoteRepository) SetStatus(ctx context.Context, noteID, status string) error {
	tag, err := r.db.Exec(ctx,
		"UPDATE notes SET status = $2, updated_at = now() WHERE id = $1", noteID, status)
	if err != nil {
		return fmt.Errorf("set note status: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// RegisterView records a unique view and increments the counter. It reports
// whether this viewer was new, so repeat reads never inflate the count.
func (r *NoteRepository) RegisterView(ctx context.Context, viewID, noteID, viewerKey string, userID *string) (bool, error) {
	tag, err := r.db.Exec(ctx, `
		INSERT INTO note_views (id, note_id, user_id, viewer_key, created_at)
		VALUES ($1, $2, $3, $4, now())
		ON CONFLICT (note_id, viewer_key) DO NOTHING`,
		viewID, noteID, userID, viewerKey,
	)
	if err != nil {
		return false, fmt.Errorf("record note view: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return false, nil
	}

	if _, err := r.db.Exec(ctx,
		"UPDATE notes SET view_count = view_count + 1 WHERE id = $1", noteID); err != nil {
		return false, fmt.Errorf("increment view count: %w", err)
	}
	return true, nil
}

// PopularTags returns the most used tags across published public notes.
func (r *NoteRepository) PopularTags(ctx context.Context, limit int) ([]models.TagCount, error) {
	rows, err := r.db.Query(ctx, `
		SELECT tag, count(*) AS total
		FROM notes n, unnest(n.tags) AS tag
		WHERE n.status = 'published' AND n.visibility = 'public'
		GROUP BY tag
		ORDER BY total DESC, tag ASC
		LIMIT $1`, limit)
	if err != nil {
		return nil, fmt.Errorf("load popular tags: %w", err)
	}
	defer rows.Close()

	tags := make([]models.TagCount, 0, limit)
	for rows.Next() {
		var t models.TagCount
		if err := rows.Scan(&t.Tag, &t.Count); err != nil {
			return nil, fmt.Errorf("scan tag: %w", err)
		}
		tags = append(tags, t)
	}
	return tags, rows.Err()
}

// Subjects returns the distinct subjects in use, for the browse filter.
func (r *NoteRepository) Subjects(ctx context.Context, limit int) ([]string, error) {
	rows, err := r.db.Query(ctx, `
		SELECT subject
		FROM notes
		WHERE subject IS NOT NULL AND subject <> ''
		  AND status = 'published' AND visibility = 'public'
		GROUP BY subject
		ORDER BY count(*) DESC
		LIMIT $1`, limit)
	if err != nil {
		return nil, fmt.Errorf("load subjects: %w", err)
	}
	defer rows.Close()

	subjects := make([]string, 0, limit)
	for rows.Next() {
		var subject string
		if err := rows.Scan(&subject); err != nil {
			return nil, fmt.Errorf("scan subject: %w", err)
		}
		subjects = append(subjects, subject)
	}
	return subjects, rows.Err()
}

// inTx runs fn inside a transaction, rolling back on any error.
func (r *NoteRepository) inTx(ctx context.Context, fn func(pgx.Tx) error) error {
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer func() {
		rollbackCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = tx.Rollback(rollbackCtx)
	}()

	if err := fn(tx); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}
	return nil
}

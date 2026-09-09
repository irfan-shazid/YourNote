// Package service holds the application rules: who may do what, in what order,
// and what has to happen alongside the primary write. Services return
// *httpx.APIError values so handlers can forward them straight to the client
// without a second layer of error translation.
package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"log"
	"time"

	"github.com/google/uuid"

	"github.com/yournote/api/internal/auth"
	"github.com/yournote/api/internal/cloudinary"
	"github.com/yournote/api/internal/httpx"
	"github.com/yournote/api/internal/models"
	"github.com/yournote/api/internal/repository"
	"github.com/yournote/api/internal/slugutil"
)

// NoteService owns everything that happens to a note.
type NoteService struct {
	notes  *repository.NoteRepository
	admin  *repository.AdminRepository
	assets *cloudinary.Client
}

// NewNoteService builds a NoteService. assets may be nil when Cloudinary is
// not configured; uploads are then simply unavailable.
func NewNoteService(notes *repository.NoteRepository, admin *repository.AdminRepository, assets *cloudinary.Client) *NoteService {
	return &NoteService{notes: notes, admin: admin, assets: assets}
}

// ListParams is the request-shaped input for a note listing, before the
// service decides which scope the caller is actually allowed to see.
type ListParams struct {
	Search       string
	Tag          string
	Subject      string
	AuthorID     string
	BookmarkedBy string
	Status       string
	Visibility   string
	Sort         string
	Page         int
	PageSize     int
	// Scope selects the listing mode: "public", "mine", "bookmarks" or "admin".
	Scope string
}

// List returns a page of notes visible to the caller.
func (s *NoteService) List(ctx context.Context, params ListParams) ([]models.Note, int, error) {
	viewer := auth.FromContext(ctx)

	filter := repository.NoteFilter{
		Search:     params.Search,
		Tag:        params.Tag,
		Subject:    params.Subject,
		AuthorID:   params.AuthorID,
		Status:     params.Status,
		Visibility: params.Visibility,
		Sort:       params.Sort,
		ViewerID:   auth.UserIDFromContext(ctx),
		Page:       params.Page,
		PageSize:   params.PageSize,
	}

	switch params.Scope {
	case "mine":
		if viewer == nil {
			return nil, 0, httpx.Unauthorized("Sign in to see your notes.")
		}
		filter.AuthorID = viewer.UserID
		filter.IncludeDrafts = true
		filter.IncludeNonPublic = true

	case "bookmarks":
		if viewer == nil {
			return nil, 0, httpx.Unauthorized("Sign in to see your saved notes.")
		}
		filter.BookmarkedBy = viewer.UserID

	case "admin":
		if !viewer.IsAdmin() {
			return nil, 0, httpx.Forbidden("Admins only.")
		}
		filter.IncludeDrafts = true
		filter.IncludeNonPublic = true
		filter.IncludeRemoved = true

	default:
		// A public listing never leaks drafts, private notes or removed notes,
		// even when the caller filters by their own author id.
		if filter.AuthorID != "" && viewer != nil && filter.AuthorID == viewer.UserID {
			filter.IncludeDrafts = true
			filter.IncludeNonPublic = true
		}
	}

	notes, total, err := s.notes.List(ctx, filter)
	if err != nil {
		return nil, 0, httpx.Internal(err)
	}
	for i := range notes {
		notes[i].Viewer.CanEdit = viewer.Owns(notes[i].Author.ID)
	}
	return notes, total, nil
}

// GetBySlug loads a note for reading, enforcing its visibility rules.
func (s *NoteService) GetBySlug(ctx context.Context, slug string) (*models.Note, error) {
	note, err := s.notes.GetBySlug(ctx, slug, auth.UserIDFromContext(ctx))
	if err != nil {
		return nil, translate(err, "That note does not exist.")
	}
	if err := s.assertCanView(ctx, note); err != nil {
		return nil, err
	}
	note.Viewer.CanEdit = auth.FromContext(ctx).Owns(note.Author.ID)
	return note, nil
}

// GetForEdit loads a note the caller intends to change.
func (s *NoteService) GetForEdit(ctx context.Context, noteID string) (*models.Note, error) {
	viewer := auth.FromContext(ctx)
	if viewer == nil {
		return nil, httpx.Unauthorized("Sign in to edit notes.")
	}

	note, err := s.notes.GetByID(ctx, noteID, viewer.UserID)
	if err != nil {
		return nil, translate(err, "That note does not exist.")
	}
	if !viewer.Owns(note.Author.ID) {
		return nil, httpx.Forbidden("You can only edit your own notes.")
	}
	note.Viewer.CanEdit = true
	return note, nil
}

// assertCanView applies the read rules: removed notes are admin-only, drafts
// and private notes are author-only, unlisted notes are readable by link.
func (s *NoteService) assertCanView(ctx context.Context, note *models.Note) error {
	viewer := auth.FromContext(ctx)
	owner := viewer.Owns(note.Author.ID)

	if note.Status == models.StatusRemoved && !viewer.IsAdmin() {
		return httpx.NotFound("That note has been removed by a moderator.")
	}
	if note.Status == models.StatusDraft && !owner {
		return httpx.NotFound("That note does not exist.")
	}
	if note.Visibility == models.VisibilityPrivate && !owner {
		return httpx.NotFound("That note does not exist.")
	}
	return nil
}

// Create publishes a new note owned by the caller.
func (s *NoteService) Create(ctx context.Context, req models.NoteRequest) (*models.Note, error) {
	viewer := auth.FromContext(ctx)
	if viewer == nil {
		return nil, httpx.Unauthorized("Sign in to publish a note.")
	}
	if errs := req.Validate(); errs.Any() {
		return nil, httpx.Invalid(errs)
	}

	insert := repository.NoteInsert{
		ID:            uuid.NewString(),
		Slug:          slugutil.Make(req.Title),
		AuthorID:      viewer.UserID,
		Request:       req,
		AttachmentIDs: newIDs(len(req.Attachments)),
	}
	if err := s.notes.Create(ctx, insert); err != nil {
		return nil, httpx.Internal(err)
	}

	note, err := s.notes.GetByID(ctx, insert.ID, viewer.UserID)
	if err != nil {
		return nil, httpx.Internal(err)
	}
	note.Viewer.CanEdit = true
	return note, nil
}

// Update replaces a note the caller owns.
func (s *NoteService) Update(ctx context.Context, noteID string, req models.NoteRequest) (*models.Note, error) {
	viewer := auth.FromContext(ctx)
	if viewer == nil {
		return nil, httpx.Unauthorized("Sign in to edit a note.")
	}
	if errs := req.Validate(); errs.Any() {
		return nil, httpx.Invalid(errs)
	}

	authorID, status, _, err := s.notes.AuthorOf(ctx, noteID)
	if err != nil {
		return nil, translate(err, "That note does not exist.")
	}
	if !viewer.Owns(authorID) {
		return nil, httpx.Forbidden("You can only edit your own notes.")
	}
	if status == models.StatusRemoved && !viewer.IsAdmin() {
		return nil, httpx.Forbidden("This note was removed by a moderator.")
	}

	previous, err := s.notes.GetByID(ctx, noteID, viewer.UserID)
	if err != nil {
		return nil, httpx.Internal(err)
	}

	if err := s.notes.Update(ctx, noteID, newIDs(len(req.Attachments)), req); err != nil {
		return nil, translate(err, "That note does not exist.")
	}

	// Assets the author dropped from the note are no longer referenced, so they
	// are removed from Cloudinary too.
	s.destroyOrphans(previous.Attachments, req.Attachments)

	note, err := s.notes.GetByID(ctx, noteID, viewer.UserID)
	if err != nil {
		return nil, httpx.Internal(err)
	}
	note.Viewer.CanEdit = true
	return note, nil
}

// Delete removes a note and its Cloudinary assets.
func (s *NoteService) Delete(ctx context.Context, noteID string) error {
	viewer := auth.FromContext(ctx)
	if viewer == nil {
		return httpx.Unauthorized("Sign in to delete a note.")
	}

	authorID, _, _, err := s.notes.AuthorOf(ctx, noteID)
	if err != nil {
		return translate(err, "That note does not exist.")
	}
	if !viewer.Owns(authorID) {
		return httpx.Forbidden("You can only delete your own notes.")
	}

	orphans, err := s.notes.Delete(ctx, noteID)
	if err != nil {
		return translate(err, "That note does not exist.")
	}
	s.destroyAssets(orphans)

	if viewer.IsAdmin() && viewer.UserID != authorID {
		s.audit(ctx, viewer.UserID, "note.delete", models.TargetNote, noteID, nil)
	}
	return nil
}

// RegisterView records a unique read of a note.
func (s *NoteService) RegisterView(ctx context.Context, noteID, clientIP, userAgent string) error {
	viewerID := auth.UserIDFromContext(ctx)

	var userID *string
	viewerKey := ""
	if viewerID != "" {
		userID = &viewerID
		viewerKey = "user:" + viewerID
	} else {
		// Anonymous readers are de-duplicated by a hash of address and client,
		// which keeps the counter honest without storing raw IP addresses.
		sum := sha256.Sum256([]byte(clientIP + "|" + userAgent))
		viewerKey = "anon:" + hex.EncodeToString(sum[:16])
	}

	if _, err := s.notes.RegisterView(ctx, uuid.NewString(), noteID, viewerKey, userID); err != nil {
		return httpx.Internal(err)
	}
	return nil
}

// PopularTags powers the tag cloud on the browse page.
func (s *NoteService) PopularTags(ctx context.Context, limit int) ([]models.TagCount, error) {
	tags, err := s.notes.PopularTags(ctx, limit)
	if err != nil {
		return nil, httpx.Internal(err)
	}
	return tags, nil
}

// Subjects powers the subject filter on the browse page.
func (s *NoteService) Subjects(ctx context.Context, limit int) ([]string, error) {
	subjects, err := s.notes.Subjects(ctx, limit)
	if err != nil {
		return nil, httpx.Internal(err)
	}
	return subjects, nil
}

// SetStatus is the moderator action that removes or restores a note.
func (s *NoteService) SetStatus(ctx context.Context, noteID, status string, reason *string) error {
	viewer := auth.FromContext(ctx)
	if !viewer.IsAdmin() {
		return httpx.Forbidden("Admins only.")
	}
	if status != models.StatusRemoved && status != models.StatusPublished {
		return httpx.BadRequest("Status must be removed or published.")
	}

	if err := s.notes.SetStatus(ctx, noteID, status); err != nil {
		return translate(err, "That note does not exist.")
	}
	s.audit(ctx, viewer.UserID, "note."+status, models.TargetNote, noteID, reason)
	return nil
}

// destroyOrphans deletes assets present in the old attachment set but absent
// from the new one.
func (s *NoteService) destroyOrphans(previous []models.Attachment, next []models.AttachmentInput) {
	kept := make(map[string]struct{}, len(next))
	for _, item := range next {
		kept[item.PublicID] = struct{}{}
	}

	var orphans []models.Attachment
	for _, existing := range previous {
		if _, stillUsed := kept[existing.PublicID]; !stillUsed {
			orphans = append(orphans, existing)
		}
	}
	s.destroyAssets(orphans)
}

// destroyAssets removes Cloudinary files best-effort, in the background.
//
// The database change has already been committed by the time this runs, so the
// caller must not wait on it: a slow or unreachable Cloudinary would otherwise
// stall the author's save for as long as the HTTP timeout. It deliberately does
// not use the request context either, because that is cancelled the moment the
// response is written. Failures are logged; the row is already gone.
func (s *NoteService) destroyAssets(assets []models.Attachment) {
	if s.assets == nil || len(assets) == 0 {
		return
	}

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()

		for _, asset := range assets {
			if err := s.assets.Destroy(ctx, asset.PublicID, asset.ResourceType); err != nil {
				log.Printf("cloudinary: failed to destroy %s: %v", asset.PublicID, err)
			}
		}
	}()
}

func (s *NoteService) audit(ctx context.Context, adminID, action, targetType, targetID string, reason *string) {
	if err := s.admin.LogAction(ctx, uuid.NewString(), adminID, action, targetType, targetID, reason); err != nil {
		log.Printf("audit: %v", err)
	}
}

// newIDs generates n identifiers up front so inserts stay inside one statement
// batch instead of round-tripping for each generated key.
func newIDs(n int) []string {
	ids := make([]string, n)
	for i := range ids {
		ids[i] = uuid.NewString()
	}
	return ids
}

// translate converts a repository error into the API error a client should see.
func translate(err error, notFoundMessage string) error {
	if errors.Is(err, repository.ErrNotFound) {
		return httpx.NotFound(notFoundMessage)
	}
	return httpx.Internal(err)
}

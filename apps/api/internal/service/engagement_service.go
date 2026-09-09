package service

import (
	"context"

	"github.com/google/uuid"

	"github.com/yournote/api/internal/auth"
	"github.com/yournote/api/internal/httpx"
	"github.com/yournote/api/internal/models"
	"github.com/yournote/api/internal/repository"
)

// EngagementService owns reactions and bookmarks: the two lightweight signals
// a reader can leave on a note.
type EngagementService struct {
	reactions *repository.ReactionRepository
	bookmarks *repository.BookmarkRepository
	notes     *repository.NoteRepository
}

// NewEngagementService builds an EngagementService.
func NewEngagementService(
	reactions *repository.ReactionRepository,
	bookmarks *repository.BookmarkRepository,
	notes *repository.NoteRepository,
) *EngagementService {
	return &EngagementService{reactions: reactions, bookmarks: bookmarks, notes: notes}
}

// React toggles one reaction type for the caller and returns the fresh totals,
// so the UI can settle on server truth instead of guessing.
func (s *EngagementService) React(ctx context.Context, noteID string, req models.ReactionRequest) (*models.ReactionResult, error) {
	viewer := auth.FromContext(ctx)
	if viewer == nil {
		return nil, httpx.Unauthorized("Sign in to react to a note.")
	}
	if errs := req.Validate(); errs.Any() {
		return nil, httpx.Invalid(errs)
	}
	if err := s.assertReadable(ctx, noteID); err != nil {
		return nil, err
	}

	reacted, err := s.reactions.Toggle(ctx, uuid.NewString(), noteID, viewer.UserID, req.Type)
	if err != nil {
		return nil, httpx.Internal(err)
	}

	counts, viewerTypes, total, err := s.reactions.Summary(ctx, noteID, viewer.UserID)
	if err != nil {
		return nil, httpx.Internal(err)
	}

	return &models.ReactionResult{
		Reacted:        reacted,
		Type:           req.Type,
		Total:          total,
		ReactionCounts: counts,
		Viewer:         viewerTypes,
	}, nil
}

// BookmarkResult reports the state of a note in the caller's saved list.
type BookmarkResult struct {
	Bookmarked bool `json:"bookmarked"`
	Total      int  `json:"total"`
}

// ToggleBookmark saves or unsaves a note for the caller.
func (s *EngagementService) ToggleBookmark(ctx context.Context, noteID string) (*BookmarkResult, error) {
	viewer := auth.FromContext(ctx)
	if viewer == nil {
		return nil, httpx.Unauthorized("Sign in to save notes.")
	}
	if err := s.assertReadable(ctx, noteID); err != nil {
		return nil, err
	}

	bookmarked, err := s.bookmarks.Toggle(ctx, uuid.NewString(), noteID, viewer.UserID)
	if err != nil {
		return nil, httpx.Internal(err)
	}

	total, err := s.bookmarks.Count(ctx, noteID)
	if err != nil {
		return nil, httpx.Internal(err)
	}
	return &BookmarkResult{Bookmarked: bookmarked, Total: total}, nil
}

// assertReadable stops a reader from reacting to something they cannot see.
func (s *EngagementService) assertReadable(ctx context.Context, noteID string) error {
	note, err := s.notes.GetByID(ctx, noteID, auth.UserIDFromContext(ctx))
	if err != nil {
		return translate(err, "That note does not exist.")
	}

	viewer := auth.FromContext(ctx)
	owner := viewer.Owns(note.Author.ID)

	switch {
	case note.Status == models.StatusRemoved:
		return httpx.Conflict("That note has been removed.")
	case note.Status == models.StatusDraft && !owner:
		return httpx.NotFound("That note does not exist.")
	case note.Visibility == models.VisibilityPrivate && !owner:
		return httpx.NotFound("That note does not exist.")
	}
	return nil
}

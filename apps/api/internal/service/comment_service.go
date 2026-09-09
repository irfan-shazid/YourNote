package service

import (
	"context"
	"log"

	"github.com/google/uuid"

	"github.com/yournote/api/internal/auth"
	"github.com/yournote/api/internal/httpx"
	"github.com/yournote/api/internal/models"
	"github.com/yournote/api/internal/repository"
)

// CommentService owns the discussion under a note.
type CommentService struct {
	comments *repository.CommentRepository
	notes    *repository.NoteRepository
	admin    *repository.AdminRepository
}

// NewCommentService builds a CommentService.
func NewCommentService(comments *repository.CommentRepository, notes *repository.NoteRepository, admin *repository.AdminRepository) *CommentService {
	return &CommentService{comments: comments, notes: notes, admin: admin}
}

// List returns the discussion for a note the caller is allowed to read.
func (s *CommentService) List(ctx context.Context, noteID string) ([]models.Comment, error) {
	if err := s.assertNoteReadable(ctx, noteID); err != nil {
		return nil, err
	}

	comments, err := s.comments.ListByNote(ctx, noteID)
	if err != nil {
		return nil, httpx.Internal(err)
	}

	viewer := auth.FromContext(ctx)
	for i := range comments {
		decorate(&comments[i], viewer)
		for j := range comments[i].Replies {
			decorate(&comments[i].Replies[j], viewer)
		}
	}
	return comments, nil
}

// decorate sets the per-viewer permission flags and hides the body of removed
// comments from everyone except admins, who need it to review a moderation.
func decorate(comment *models.Comment, viewer *auth.Identity) {
	comment.CanEdit = viewer != nil && viewer.UserID == comment.Author.ID && !comment.IsDeleted
	comment.CanDelete = viewer.Owns(comment.Author.ID)

	if comment.IsDeleted && !viewer.IsAdmin() {
		comment.Content = ""
	}
}

// Create posts a comment, or a reply when parentId is set.
func (s *CommentService) Create(ctx context.Context, noteID string, req models.CommentRequest) (*models.Comment, error) {
	viewer := auth.FromContext(ctx)
	if viewer == nil {
		return nil, httpx.Unauthorized("Sign in to join the discussion.")
	}
	if errs := req.Validate(); errs.Any() {
		return nil, httpx.Invalid(errs)
	}
	if err := s.assertNoteReadable(ctx, noteID); err != nil {
		return nil, err
	}

	// Replies may only attach to a top-level comment on the same note, which
	// keeps threads two levels deep and stops cross-note reparenting.
	if req.ParentID != nil {
		parent, err := s.comments.GetByID(ctx, *req.ParentID)
		if err != nil {
			return nil, translate(err, "That comment no longer exists.")
		}
		if parent.NoteID != noteID {
			return nil, httpx.BadRequest("That comment belongs to a different note.")
		}
		if parent.ParentID != nil {
			req.ParentID = parent.ParentID
		}
		if parent.IsDeleted {
			return nil, httpx.Conflict("That comment was removed.")
		}
	}

	comment, err := s.comments.Create(ctx, uuid.NewString(), noteID, viewer.UserID, req.ParentID, req.Content)
	if err != nil {
		return nil, httpx.Internal(err)
	}
	decorate(comment, viewer)
	return comment, nil
}

// Update edits a comment the caller wrote.
func (s *CommentService) Update(ctx context.Context, commentID string, req models.CommentRequest) (*models.Comment, error) {
	viewer := auth.FromContext(ctx)
	if viewer == nil {
		return nil, httpx.Unauthorized("Sign in to edit your comment.")
	}
	if errs := req.Validate(); errs.Any() {
		return nil, httpx.Invalid(errs)
	}

	existing, err := s.comments.GetByID(ctx, commentID)
	if err != nil {
		return nil, translate(err, "That comment no longer exists.")
	}
	// Editing is limited to the author: an admin can remove a comment but never
	// rewrite what somebody else said.
	if existing.Author.ID != viewer.UserID {
		return nil, httpx.Forbidden("You can only edit your own comments.")
	}
	if existing.IsDeleted {
		return nil, httpx.Conflict("This comment was removed.")
	}

	if err := s.comments.Update(ctx, commentID, req.Content); err != nil {
		return nil, translate(err, "That comment no longer exists.")
	}

	updated, err := s.comments.GetByID(ctx, commentID)
	if err != nil {
		return nil, httpx.Internal(err)
	}
	decorate(updated, viewer)
	return updated, nil
}

// Delete removes a comment. Authors may remove their own; admins may remove
// anybody's, and that action is written to the audit log.
func (s *CommentService) Delete(ctx context.Context, commentID string, reason *string) error {
	viewer := auth.FromContext(ctx)
	if viewer == nil {
		return httpx.Unauthorized("Sign in to remove a comment.")
	}

	existing, err := s.comments.GetByID(ctx, commentID)
	if err != nil {
		return translate(err, "That comment no longer exists.")
	}
	if !viewer.Owns(existing.Author.ID) {
		return httpx.Forbidden("You can only remove your own comments.")
	}

	if err := s.comments.SoftDelete(ctx, commentID, viewer.UserID, reason); err != nil {
		return translate(err, "That comment was already removed.")
	}

	if viewer.IsAdmin() && existing.Author.ID != viewer.UserID {
		s.audit(ctx, viewer.UserID, "comment.remove", models.TargetComment, commentID, reason)
	}
	return nil
}

// Restore brings back a comment an admin removed.
func (s *CommentService) Restore(ctx context.Context, commentID string) error {
	viewer := auth.FromContext(ctx)
	if !viewer.IsAdmin() {
		return httpx.Forbidden("Admins only.")
	}
	if err := s.comments.Restore(ctx, commentID); err != nil {
		return translate(err, "That comment no longer exists.")
	}
	s.audit(ctx, viewer.UserID, "comment.restore", models.TargetComment, commentID, nil)
	return nil
}

// PurgeForever deletes a comment and its replies permanently.
func (s *CommentService) PurgeForever(ctx context.Context, commentID string, reason *string) error {
	viewer := auth.FromContext(ctx)
	if !viewer.IsAdmin() {
		return httpx.Forbidden("Admins only.")
	}
	if err := s.comments.HardDelete(ctx, commentID); err != nil {
		return translate(err, "That comment no longer exists.")
	}
	s.audit(ctx, viewer.UserID, "comment.purge", models.TargetComment, commentID, reason)
	return nil
}

// ListForModeration returns the admin moderation queue.
func (s *CommentService) ListForModeration(ctx context.Context, filter repository.AdminCommentFilter) ([]models.AdminComment, int, error) {
	if !auth.FromContext(ctx).IsAdmin() {
		return nil, 0, httpx.Forbidden("Admins only.")
	}
	comments, total, err := s.comments.ListForModeration(ctx, filter)
	if err != nil {
		return nil, 0, httpx.Internal(err)
	}
	return comments, total, nil
}

// assertNoteReadable reuses the note visibility rules so a private note never
// leaks its discussion.
func (s *CommentService) assertNoteReadable(ctx context.Context, noteID string) error {
	note, err := s.notes.GetByID(ctx, noteID, auth.UserIDFromContext(ctx))
	if err != nil {
		return translate(err, "That note does not exist.")
	}

	viewer := auth.FromContext(ctx)
	owner := viewer.Owns(note.Author.ID)

	switch {
	case note.Status == models.StatusRemoved && !viewer.IsAdmin():
		return httpx.NotFound("That note has been removed by a moderator.")
	case note.Status == models.StatusDraft && !owner:
		return httpx.NotFound("That note does not exist.")
	case note.Visibility == models.VisibilityPrivate && !owner:
		return httpx.NotFound("That note does not exist.")
	}
	return nil
}

func (s *CommentService) audit(ctx context.Context, adminID, action, targetType, targetID string, reason *string) {
	if err := s.admin.LogAction(ctx, uuid.NewString(), adminID, action, targetType, targetID, reason); err != nil {
		log.Printf("audit: %v", err)
	}
}

package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/yournote/api/internal/httpx"
	"github.com/yournote/api/internal/models"
	"github.com/yournote/api/internal/repository"
	"github.com/yournote/api/internal/service"
)

// CommentHandler serves the discussion endpoints.
type CommentHandler struct {
	comments *service.CommentService
}

// NewCommentHandler builds a CommentHandler.
func NewCommentHandler(comments *service.CommentService) *CommentHandler {
	return &CommentHandler{comments: comments}
}

// List handles GET /notes/{id}/comments.
func (h *CommentHandler) List(w http.ResponseWriter, r *http.Request) {
	comments, err := h.comments.List(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.OK(w, comments)
}

// Create handles POST /notes/{id}/comments.
func (h *CommentHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CommentRequest
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		httpx.Error(w, r, err)
		return
	}

	comment, err := h.comments.Create(r.Context(), chi.URLParam(r, "id"), req)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.Created(w, comment)
}

// Update handles PATCH /comments/{id}.
func (h *CommentHandler) Update(w http.ResponseWriter, r *http.Request) {
	var req models.CommentRequest
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		httpx.Error(w, r, err)
		return
	}

	comment, err := h.comments.Update(r.Context(), chi.URLParam(r, "id"), req)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.OK(w, comment)
}

// Delete handles DELETE /comments/{id}. Authors remove their own comments here;
// admins remove anybody's, optionally with a reason for the audit log.
func (h *CommentHandler) Delete(w http.ResponseWriter, r *http.Request) {
	reason := optionalReason(r)

	if err := h.comments.Delete(r.Context(), chi.URLParam(r, "id"), reason); err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.NoContent(w)
}

// Restore handles POST /admin/comments/{id}/restore.
func (h *CommentHandler) Restore(w http.ResponseWriter, r *http.Request) {
	if err := h.comments.Restore(r.Context(), chi.URLParam(r, "id")); err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.NoContent(w)
}

// Purge handles DELETE /admin/comments/{id}/purge - permanent removal.
func (h *CommentHandler) Purge(w http.ResponseWriter, r *http.Request) {
	if err := h.comments.PurgeForever(r.Context(), chi.URLParam(r, "id"), optionalReason(r)); err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.NoContent(w)
}

// AdminList handles GET /admin/comments - the moderation queue.
func (h *CommentHandler) AdminList(w http.ResponseWriter, r *http.Request) {
	page, pageSize := httpx.Page(r), httpx.PageSize(r)

	comments, total, err := h.comments.ListForModeration(r.Context(), repository.AdminCommentFilter{
		Search:   httpx.Query(r, "search"),
		Status:   httpx.Query(r, "status"),
		NoteID:   httpx.Query(r, "noteId"),
		AuthorID: httpx.Query(r, "authorId"),
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.List(w, comments, httpx.NewPaginationMeta(page, pageSize, total))
}

// optionalReason reads a moderation reason from the query string, which keeps
// DELETE requests body-free.
func optionalReason(r *http.Request) *string {
	if reason := httpx.Query(r, "reason"); reason != "" {
		return &reason
	}
	return nil
}

// Package handler adapts HTTP requests to service calls. Handlers parse input,
// delegate every decision to a service, and render the result - no business
// rules live here.
package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/yournote/api/internal/auth"
	"github.com/yournote/api/internal/httpx"
	"github.com/yournote/api/internal/models"
	"github.com/yournote/api/internal/service"
)

// NoteHandler serves the note endpoints.
type NoteHandler struct {
	notes *service.NoteService
}

// NewNoteHandler builds a NoteHandler.
func NewNoteHandler(notes *service.NoteService) *NoteHandler {
	return &NoteHandler{notes: notes}
}

// List handles GET /notes.
func (h *NoteHandler) List(w http.ResponseWriter, r *http.Request) {
	page, pageSize := httpx.Page(r), httpx.PageSize(r)

	notes, total, err := h.notes.List(r.Context(), service.ListParams{
		Search:   httpx.Query(r, "search"),
		Tag:      httpx.Query(r, "tag"),
		Subject:  httpx.Query(r, "subject"),
		AuthorID: httpx.Query(r, "authorId"),
		Sort:     httpx.Query(r, "sort"),
		Scope:    httpx.Query(r, "scope"),
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.List(w, notes, httpx.NewPaginationMeta(page, pageSize, total))
}

// Mine handles GET /me/notes - the author dashboard, drafts included.
func (h *NoteHandler) Mine(w http.ResponseWriter, r *http.Request) {
	page, pageSize := httpx.Page(r), httpx.PageSize(r)

	notes, total, err := h.notes.List(r.Context(), service.ListParams{
		Scope:    "mine",
		Search:   httpx.Query(r, "search"),
		Status:   httpx.Query(r, "status"),
		Sort:     httpx.Query(r, "sort"),
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.List(w, notes, httpx.NewPaginationMeta(page, pageSize, total))
}

// Bookmarked handles GET /me/bookmarks.
func (h *NoteHandler) Bookmarked(w http.ResponseWriter, r *http.Request) {
	page, pageSize := httpx.Page(r), httpx.PageSize(r)

	notes, total, err := h.notes.List(r.Context(), service.ListParams{
		Scope:    "bookmarks",
		Search:   httpx.Query(r, "search"),
		Sort:     httpx.Query(r, "sort"),
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.List(w, notes, httpx.NewPaginationMeta(page, pageSize, total))
}

// GetBySlug handles GET /notes/{slug}.
func (h *NoteHandler) GetBySlug(w http.ResponseWriter, r *http.Request) {
	note, err := h.notes.GetBySlug(r.Context(), chi.URLParam(r, "slug"))
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.OK(w, note)
}

// GetForEdit handles GET /notes/{id}/edit.
func (h *NoteHandler) GetForEdit(w http.ResponseWriter, r *http.Request) {
	note, err := h.notes.GetForEdit(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.OK(w, note)
}

// Create handles POST /notes.
func (h *NoteHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.NoteRequest
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		httpx.Error(w, r, err)
		return
	}

	note, err := h.notes.Create(r.Context(), req)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.Created(w, note)
}

// Update handles PUT /notes/{id}.
func (h *NoteHandler) Update(w http.ResponseWriter, r *http.Request) {
	var req models.NoteRequest
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		httpx.Error(w, r, err)
		return
	}

	note, err := h.notes.Update(r.Context(), chi.URLParam(r, "id"), req)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.OK(w, note)
}

// Delete handles DELETE /notes/{id}.
func (h *NoteHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if err := h.notes.Delete(r.Context(), chi.URLParam(r, "id")); err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.NoContent(w)
}

// RegisterView handles POST /notes/{id}/view.
func (h *NoteHandler) RegisterView(w http.ResponseWriter, r *http.Request) {
	err := h.notes.RegisterView(
		r.Context(),
		chi.URLParam(r, "id"),
		httpx.ClientIP(r),
		r.UserAgent(),
	)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.NoContent(w)
}

// Tags handles GET /tags.
func (h *NoteHandler) Tags(w http.ResponseWriter, r *http.Request) {
	tags, err := h.notes.PopularTags(r.Context(), 24)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.OK(w, tags)
}

// Subjects handles GET /subjects.
func (h *NoteHandler) Subjects(w http.ResponseWriter, r *http.Request) {
	subjects, err := h.notes.Subjects(r.Context(), 24)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.OK(w, subjects)
}

// SetStatus handles PATCH /admin/notes/{id}/status - remove or restore a note.
func (h *NoteHandler) SetStatus(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Status string  `json:"status"`
		Reason *string `json:"reason"`
	}
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		httpx.Error(w, r, err)
		return
	}

	if err := h.notes.SetStatus(r.Context(), chi.URLParam(r, "id"), req.Status, req.Reason); err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.NoContent(w)
}

// AdminList handles GET /admin/notes - every note, whatever its state.
func (h *NoteHandler) AdminList(w http.ResponseWriter, r *http.Request) {
	page, pageSize := httpx.Page(r), httpx.PageSize(r)

	notes, total, err := h.notes.List(r.Context(), service.ListParams{
		Scope:      "admin",
		Search:     httpx.Query(r, "search"),
		Status:     httpx.Query(r, "status"),
		Visibility: httpx.Query(r, "visibility"),
		Sort:       httpx.Query(r, "sort"),
		Page:       page,
		PageSize:   pageSize,
	})
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.List(w, notes, httpx.NewPaginationMeta(page, pageSize, total))
}

// Session handles GET /me - the identity behind the current session.
func Session(w http.ResponseWriter, r *http.Request) {
	identity := auth.FromContext(r.Context())
	if identity == nil {
		httpx.OK(w, nil)
		return
	}
	httpx.OK(w, identity)
}

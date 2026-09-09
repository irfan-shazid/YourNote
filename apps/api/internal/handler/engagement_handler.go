package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/yournote/api/internal/httpx"
	"github.com/yournote/api/internal/models"
	"github.com/yournote/api/internal/service"
)

// EngagementHandler serves reactions and bookmarks.
type EngagementHandler struct {
	engagement *service.EngagementService
}

// NewEngagementHandler builds an EngagementHandler.
func NewEngagementHandler(engagement *service.EngagementService) *EngagementHandler {
	return &EngagementHandler{engagement: engagement}
}

// React handles POST /notes/{id}/reactions.
func (h *EngagementHandler) React(w http.ResponseWriter, r *http.Request) {
	var req models.ReactionRequest
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		httpx.Error(w, r, err)
		return
	}

	result, err := h.engagement.React(r.Context(), chi.URLParam(r, "id"), req)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.OK(w, result)
}

// Bookmark handles POST /notes/{id}/bookmark.
func (h *EngagementHandler) Bookmark(w http.ResponseWriter, r *http.Request) {
	result, err := h.engagement.ToggleBookmark(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.OK(w, result)
}

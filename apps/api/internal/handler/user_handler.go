package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/yournote/api/internal/httpx"
	"github.com/yournote/api/internal/models"
	"github.com/yournote/api/internal/service"
)

// UserHandler serves public profiles and the caller's own account.
type UserHandler struct {
	users   *service.UserService
	uploads *service.UploadService
}

// NewUserHandler builds a UserHandler.
func NewUserHandler(users *service.UserService, uploads *service.UploadService) *UserHandler {
	return &UserHandler{users: users, uploads: uploads}
}

// Profile handles GET /users/{id}.
func (h *UserHandler) Profile(w http.ResponseWriter, r *http.Request) {
	profile, err := h.users.Profile(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.OK(w, profile)
}

// UpdateProfile handles PATCH /me.
func (h *UserHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	var req models.ProfileRequest
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		httpx.Error(w, r, err)
		return
	}

	profile, err := h.users.UpdateProfile(r.Context(), req)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.OK(w, profile)
}

// UploadSignature handles POST /uploads/signature.
func (h *UserHandler) UploadSignature(w http.ResponseWriter, r *http.Request) {
	signature, err := h.uploads.Signature(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.OK(w, signature)
}

package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/yournote/api/internal/httpx"
	"github.com/yournote/api/internal/models"
	"github.com/yournote/api/internal/repository"
	"github.com/yournote/api/internal/service"
)

// AdminHandler serves the admin panel endpoints.
type AdminHandler struct {
	admin *service.AdminService
}

// NewAdminHandler builds an AdminHandler.
func NewAdminHandler(admin *service.AdminService) *AdminHandler {
	return &AdminHandler{admin: admin}
}

// Overview handles GET /admin/stats.
func (h *AdminHandler) Overview(w http.ResponseWriter, r *http.Request) {
	stats, err := h.admin.Overview(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.OK(w, stats)
}

// ListUsers handles GET /admin/users.
func (h *AdminHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	page, pageSize := httpx.Page(r), httpx.PageSize(r)

	users, total, err := h.admin.ListUsers(r.Context(), repository.AdminUserFilter{
		Search:   httpx.Query(r, "search"),
		Role:     httpx.Query(r, "role"),
		Status:   httpx.Query(r, "status"),
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.List(w, users, httpx.NewPaginationMeta(page, pageSize, total))
}

// UpdateUser handles PATCH /admin/users/{id} - role changes, bans and unbans.
func (h *AdminHandler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	var req models.UserStatusRequest
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		httpx.Error(w, r, err)
		return
	}

	if err := h.admin.UpdateUser(r.Context(), chi.URLParam(r, "id"), req); err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.NoContent(w)
}

// DeleteUser handles DELETE /admin/users/{id}.
func (h *AdminHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	if err := h.admin.DeleteUser(r.Context(), chi.URLParam(r, "id"), optionalReason(r)); err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.NoContent(w)
}

// CreateReport handles POST /reports - any signed-in user can file one.
func (h *AdminHandler) CreateReport(w http.ResponseWriter, r *http.Request) {
	var req models.ReportRequest
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		httpx.Error(w, r, err)
		return
	}

	if err := h.admin.Report(r.Context(), req); err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.Created(w, map[string]string{"status": "received"})
}

// ListReports handles GET /admin/reports.
func (h *AdminHandler) ListReports(w http.ResponseWriter, r *http.Request) {
	page, pageSize := httpx.Page(r), httpx.PageSize(r)

	reports, total, err := h.admin.ListReports(r.Context(), httpx.Query(r, "status"), page, pageSize)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.List(w, reports, httpx.NewPaginationMeta(page, pageSize, total))
}

// ResolveReport handles PATCH /admin/reports/{id}.
func (h *AdminHandler) ResolveReport(w http.ResponseWriter, r *http.Request) {
	var req models.ReportStatusRequest
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		httpx.Error(w, r, err)
		return
	}

	if err := h.admin.ResolveReport(r.Context(), chi.URLParam(r, "id"), req); err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.NoContent(w)
}

// Activity handles GET /admin/activity - the moderation audit trail.
func (h *AdminHandler) Activity(w http.ResponseWriter, r *http.Request) {
	page, pageSize := httpx.Page(r), httpx.PageSize(r)

	entries, total, err := h.admin.ListActions(r.Context(), page, pageSize)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.List(w, entries, httpx.NewPaginationMeta(page, pageSize, total))
}

package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yournote/api/internal/httpx"
)

// HealthHandler reports whether the service and its database are usable.
type HealthHandler struct {
	db      *pgxpool.Pool
	version string
	started time.Time
}

// NewHealthHandler builds a HealthHandler.
func NewHealthHandler(db *pgxpool.Pool, version string) *HealthHandler {
	return &HealthHandler{db: db, version: version, started: time.Now()}
}

// Health handles GET /health. It pings the database so a green check really
// means the API can serve traffic.
func (h *HealthHandler) Health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	status := "ok"
	database := "ok"
	code := http.StatusOK

	if err := h.db.Ping(ctx); err != nil {
		status, database, code = "degraded", "unreachable", http.StatusServiceUnavailable
	}

	httpx.JSON(w, code, map[string]any{
		"status":   status,
		"database": database,
		"version":  h.version,
		"uptime":   time.Since(h.started).Round(time.Second).String(),
	})
}

package router

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/yournote/api/internal/config"
	"github.com/yournote/api/internal/handler"
	"github.com/yournote/api/internal/middleware"
)

// newTestRouter builds the real route tree. The collaborators are nil because
// this exercises routing and the auth gates only - neither reaches a service
// without a valid session, which an unauthenticated test request never has.
func newTestRouter(t *testing.T) http.Handler {
	t.Helper()

	return New(Dependencies{
		Config: config.Config{
			AllowedOrigins: []string{"http://localhost:3000"},
			RequestTimeout: 5 * time.Second,
			RateLimit:      config.RateLimit{Requests: 1000, Window: time.Minute},
		},
		Authenticator: middleware.NewAuthenticator(nil, "test-secret", false),
		Health:        handler.NewHealthHandler(nil, "test"),
		Notes:         handler.NewNoteHandler(nil),
		Comments:      handler.NewCommentHandler(nil),
		Engagement:    handler.NewEngagementHandler(nil),
		Users:         handler.NewUserHandler(nil, nil),
		Admin:         handler.NewAdminHandler(nil),
	})
}

// TestRouteTreeBuilds is the regression guard for chi pattern conflicts: the
// note detail route is matched by slug while its sub-resources are matched by
// id, and chi panics at construction time if that is ambiguous.
func TestRouteTreeBuilds(t *testing.T) {
	mux, ok := newTestRouter(t).(chi.Routes)
	if !ok {
		t.Fatal("router does not expose its routes")
	}

	registered := map[string]bool{}
	err := chi.Walk(mux, func(method, route string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		registered[method+" "+strings.TrimSuffix(route, "/")] = true
		return nil
	})
	if err != nil {
		t.Fatalf("walk routes: %v", err)
	}

	want := []string{
		"GET /health",
		"GET /api/v1/notes",
		"POST /api/v1/notes",
		"GET /api/v1/notes/{slug}",
		"PUT /api/v1/notes/{id}",
		"DELETE /api/v1/notes/{id}",
		"GET /api/v1/notes/{id}/comments",
		"POST /api/v1/notes/{id}/comments",
		"POST /api/v1/notes/{id}/reactions",
		"POST /api/v1/notes/{id}/bookmark",
		"POST /api/v1/notes/{id}/view",
		"PATCH /api/v1/comments/{id}",
		"DELETE /api/v1/comments/{id}",
		"GET /api/v1/me",
		"GET /api/v1/me/notes",
		"GET /api/v1/me/bookmarks",
		"POST /api/v1/uploads/signature",
		"GET /api/v1/admin/stats",
		"GET /api/v1/admin/users",
		"PATCH /api/v1/admin/users/{id}",
		"GET /api/v1/admin/comments",
		"DELETE /api/v1/admin/comments/{id}",
		"GET /api/v1/admin/reports",
		"GET /api/v1/admin/activity",
	}
	for _, route := range want {
		if !registered[route] {
			t.Errorf("route not registered: %s", route)
		}
	}
}

// TestProtectedRoutesRejectAnonymous proves the auth gates run before any
// handler does, so a nil service can never be reached without a session.
func TestProtectedRoutesRejectAnonymous(t *testing.T) {
	mux := newTestRouter(t)

	cases := []struct {
		method string
		path   string
		want   int
	}{
		{http.MethodPost, "/api/v1/notes", http.StatusUnauthorized},
		{http.MethodPut, "/api/v1/notes/abc", http.StatusUnauthorized},
		{http.MethodDelete, "/api/v1/notes/abc", http.StatusUnauthorized},
		{http.MethodPost, "/api/v1/notes/abc/reactions", http.StatusUnauthorized},
		{http.MethodPost, "/api/v1/notes/abc/bookmark", http.StatusUnauthorized},
		{http.MethodPost, "/api/v1/notes/abc/comments", http.StatusUnauthorized},
		{http.MethodPatch, "/api/v1/comments/abc", http.StatusUnauthorized},
		{http.MethodPost, "/api/v1/uploads/signature", http.StatusUnauthorized},
		{http.MethodGet, "/api/v1/me/notes", http.StatusUnauthorized},
		{http.MethodGet, "/api/v1/admin/stats", http.StatusUnauthorized},
		{http.MethodGet, "/api/v1/admin/users", http.StatusUnauthorized},
		{http.MethodDelete, "/api/v1/admin/comments/abc", http.StatusUnauthorized},
		{http.MethodGet, "/api/v1/nope", http.StatusNotFound},
	}

	for _, tc := range cases {
		req := httptest.NewRequest(tc.method, tc.path, nil)
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)

		if rec.Code != tc.want {
			t.Errorf("%s %s = %d, want %d", tc.method, tc.path, rec.Code, tc.want)
		}
	}
}

// TestSessionEndpointIsAnonymousSafe confirms /me answers without a session
// instead of erroring, which is what the web app polls on first load.
func TestSessionEndpointIsAnonymousSafe(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	rec := httptest.NewRecorder()
	newTestRouter(t).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("GET /api/v1/me = %d, want 200", rec.Code)
	}
	if body := rec.Body.String(); !strings.Contains(body, "null") {
		t.Errorf("anonymous session body = %q, want a null payload", body)
	}
}

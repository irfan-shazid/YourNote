// Package router wires the whole HTTP surface together in one readable place.
package router

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/yournote/api/internal/config"
	"github.com/yournote/api/internal/handler"
	"github.com/yournote/api/internal/httpx"
	"github.com/yournote/api/internal/middleware"
)

// Dependencies are the constructed collaborators the router mounts.
type Dependencies struct {
	Config        config.Config
	Authenticator *middleware.Authenticator
	Health        *handler.HealthHandler
	Notes         *handler.NoteHandler
	Comments      *handler.CommentHandler
	Engagement    *handler.EngagementHandler
	Users         *handler.UserHandler
	Admin         *handler.AdminHandler
}

// New builds the HTTP handler for the API.
func New(deps Dependencies) http.Handler {
	r := chi.NewRouter()

	limiter := middleware.NewRateLimiter(deps.Config.RateLimit.Requests, deps.Config.RateLimit.Window)

	r.Use(middleware.Recoverer)
	r.Use(middleware.Logger)
	r.Use(chimw.RealIP)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: deps.Config.AllowedOrigins,
		AllowedMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions},
		AllowedHeaders: []string{"Accept", "Authorization", "Content-Type"},
		// The browser must send the Better Auth session cookie on every call.
		AllowCredentials: true,
		MaxAge:           300,
	}))
	r.Use(chimw.Timeout(deps.Config.RequestTimeout))
	// Identity is resolved once, up front: downstream gates and services all
	// read it from the request context.
	r.Use(deps.Authenticator.Resolve)
	r.Use(limiter.Middleware)

	r.Get("/health", deps.Health.Health)

	r.Route("/api/v1", func(api chi.Router) {
		// ---- public reads -------------------------------------------------
		api.Get("/notes", deps.Notes.List)
		api.Get("/notes/{slug}", deps.Notes.GetBySlug)
		api.Get("/tags", deps.Notes.Tags)
		api.Get("/subjects", deps.Notes.Subjects)
		api.Get("/users/{id}", deps.Users.Profile)
		api.Get("/me", handler.Session)

		// Comment reads and view pings stay open so a signed-out reader still
		// sees the discussion; the service enforces note visibility.
		api.Get("/notes/{id}/comments", deps.Comments.List)
		api.Post("/notes/{id}/view", deps.Notes.RegisterView)

		// ---- authenticated writes ----------------------------------------
		api.Group(func(private chi.Router) {
			private.Use(middleware.RequireUser)

			private.Patch("/me", deps.Users.UpdateProfile)
			private.Get("/me/notes", deps.Notes.Mine)
			private.Get("/me/bookmarks", deps.Notes.Bookmarked)

			private.Post("/notes", deps.Notes.Create)
			private.Get("/notes/{id}/edit", deps.Notes.GetForEdit)
			private.Put("/notes/{id}", deps.Notes.Update)
			private.Delete("/notes/{id}", deps.Notes.Delete)

			private.Post("/notes/{id}/comments", deps.Comments.Create)
			private.Patch("/comments/{id}", deps.Comments.Update)
			private.Delete("/comments/{id}", deps.Comments.Delete)

			private.Post("/notes/{id}/reactions", deps.Engagement.React)
			private.Post("/notes/{id}/bookmark", deps.Engagement.Bookmark)

			private.Post("/reports", deps.Admin.CreateReport)
			private.Post("/uploads/signature", deps.Users.UploadSignature)
		})

		// ---- admin panel --------------------------------------------------
		api.Route("/admin", func(admin chi.Router) {
			admin.Use(middleware.RequireAdmin)

			admin.Get("/stats", deps.Admin.Overview)
			admin.Get("/activity", deps.Admin.Activity)

			admin.Get("/users", deps.Admin.ListUsers)
			admin.Patch("/users/{id}", deps.Admin.UpdateUser)
			admin.Delete("/users/{id}", deps.Admin.DeleteUser)

			admin.Get("/notes", deps.Notes.AdminList)
			admin.Patch("/notes/{id}/status", deps.Notes.SetStatus)
			admin.Delete("/notes/{id}", deps.Notes.Delete)

			admin.Get("/comments", deps.Comments.AdminList)
			admin.Delete("/comments/{id}", deps.Comments.Delete)
			admin.Post("/comments/{id}/restore", deps.Comments.Restore)
			admin.Delete("/comments/{id}/purge", deps.Comments.Purge)

			admin.Get("/reports", deps.Admin.ListReports)
			admin.Patch("/reports/{id}", deps.Admin.ResolveReport)
		})
	})

	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		httpx.Error(w, r, httpx.NotFound("That endpoint does not exist."))
	})
	r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		httpx.Error(w, r, httpx.BadRequest("That method is not allowed on this endpoint."))
	})

	return r
}

// ShutdownTimeout is how long in-flight requests get to finish on shutdown.
const ShutdownTimeout = 15 * time.Second

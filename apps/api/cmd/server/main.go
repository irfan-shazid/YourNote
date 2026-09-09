// Command server runs the YourNote API: the single backend for notes,
// discussions, reactions, uploads and moderation.
//
// Authentication is issued by Better Auth in the Next.js app and persisted to
// the same Postgres database, so this service authenticates every request by
// resolving the session token it receives - no auth logic is duplicated.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/yournote/api/internal/cloudinary"
	"github.com/yournote/api/internal/config"
	"github.com/yournote/api/internal/database"
	"github.com/yournote/api/internal/handler"
	"github.com/yournote/api/internal/middleware"
	"github.com/yournote/api/internal/repository"
	"github.com/yournote/api/internal/router"
	"github.com/yournote/api/internal/service"
)

// version is stamped into the health endpoint.
const version = "1.0.0"

func main() {
	log.SetFlags(log.LstdFlags | log.Lmsgprefix)
	log.SetPrefix("yournote-api ")

	if err := run(); err != nil {
		log.Fatalf("fatal: %v", err)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	// --- repositories -------------------------------------------------------
	sessions := repository.NewSessionRepository(pool)
	notes := repository.NewNoteRepository(pool)
	comments := repository.NewCommentRepository(pool)
	reactions := repository.NewReactionRepository(pool)
	bookmarks := repository.NewBookmarkRepository(pool)
	users := repository.NewUserRepository(pool)
	adminRepo := repository.NewAdminRepository(pool)

	// --- external services --------------------------------------------------
	var assets *cloudinary.Client
	if cfg.Cloudinary.Configured() {
		assets = cloudinary.New(
			cfg.Cloudinary.CloudName,
			cfg.Cloudinary.APIKey,
			cfg.Cloudinary.APISecret,
			cfg.Cloudinary.Folder,
		)
	} else {
		log.Println("cloudinary: credentials missing, file uploads are disabled")
	}

	// --- services -----------------------------------------------------------
	noteService := service.NewNoteService(notes, adminRepo, assets)
	commentService := service.NewCommentService(comments, notes, adminRepo)
	engagementService := service.NewEngagementService(reactions, bookmarks, notes)
	userService := service.NewUserService(users)
	uploadService := service.NewUploadService(assets)
	adminService := service.NewAdminService(adminRepo, notes)

	// --- transport ----------------------------------------------------------
	api := router.New(router.Dependencies{
		Config:        cfg,
		Authenticator: middleware.NewAuthenticator(sessions, cfg.AuthSecret, cfg.StrictCookieSig),
		Health:        handler.NewHealthHandler(pool, version),
		Notes:         handler.NewNoteHandler(noteService),
		Comments:      handler.NewCommentHandler(commentService),
		Engagement:    handler.NewEngagementHandler(engagementService),
		Users:         handler.NewUserHandler(userService, uploadService),
		Admin:         handler.NewAdminHandler(adminService),
	})

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           api,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       2 * time.Minute,
	}

	serverErrors := make(chan error, 1)
	go func() {
		log.Printf("listening on http://localhost:%s (env: %s)", cfg.Port, cfg.Env)
		log.Printf("cors origins: %v", cfg.AllowedOrigins)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErrors <- err
		}
	}()

	select {
	case err := <-serverErrors:
		return err
	case <-ctx.Done():
		log.Println("shutdown signal received, draining connections")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), router.ShutdownTimeout)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		// Forcing the close still beats hanging forever on a stuck request.
		_ = server.Close()
		return err
	}
	log.Println("stopped cleanly")
	return nil
}

package service

import (
	"context"
	"log"
	"time"

	"github.com/google/uuid"

	"github.com/yournote/api/internal/auth"
	"github.com/yournote/api/internal/httpx"
	"github.com/yournote/api/internal/models"
	"github.com/yournote/api/internal/repository"
)

// AdminService backs the admin panel. Every method re-checks the caller's role
// rather than trusting the route it was reached through.
type AdminService struct {
	admin *repository.AdminRepository
	notes *repository.NoteRepository
}

// NewAdminService builds an AdminService.
func NewAdminService(admin *repository.AdminRepository, notes *repository.NoteRepository) *AdminService {
	return &AdminService{admin: admin, notes: notes}
}

// Overview assembles the dashboard: counters, two 14-day trends, the busiest
// notes and the newest sign-ups.
func (s *AdminService) Overview(ctx context.Context) (*models.AdminStats, error) {
	if err := s.assertAdmin(ctx); err != nil {
		return nil, err
	}

	stats, err := s.admin.Counters(ctx)
	if err != nil {
		return nil, httpx.Internal(err)
	}

	if stats.SignupTrend, err = s.admin.Trend(ctx, "users", 14); err != nil {
		return nil, httpx.Internal(err)
	}
	if stats.NoteTrend, err = s.admin.Trend(ctx, "notes", 14); err != nil {
		return nil, httpx.Internal(err)
	}

	topNotes, _, err := s.notes.List(ctx, repository.NoteFilter{
		ViewerID:         auth.UserIDFromContext(ctx),
		Sort:             "popular",
		IncludeDrafts:    true,
		IncludeNonPublic: true,
		IncludeRemoved:   true,
		Page:             1,
		PageSize:         5,
	})
	if err != nil {
		return nil, httpx.Internal(err)
	}
	stats.TopNotes = topNotes

	if stats.RecentUsers, err = s.admin.RecentUsers(ctx, 6); err != nil {
		return nil, httpx.Internal(err)
	}
	return &stats, nil
}

// ListUsers returns a page of the user table.
func (s *AdminService) ListUsers(ctx context.Context, filter repository.AdminUserFilter) ([]models.AdminUser, int, error) {
	if err := s.assertAdmin(ctx); err != nil {
		return nil, 0, err
	}
	users, total, err := s.admin.ListUsers(ctx, filter)
	if err != nil {
		return nil, 0, httpx.Internal(err)
	}
	return users, total, nil
}

// UpdateUser applies a role change, a ban or an unban, and signs the user out
// everywhere when they are banned or demoted.
func (s *AdminService) UpdateUser(ctx context.Context, userID string, req models.UserStatusRequest) error {
	if err := s.assertAdmin(ctx); err != nil {
		return err
	}
	viewer := auth.FromContext(ctx)

	if errs := req.Validate(); errs.Any() {
		return httpx.Invalid(errs)
	}
	// An admin cannot lock themselves out of the panel by accident.
	if userID == viewer.UserID {
		return httpx.Forbidden("You cannot change your own role or ban yourself.")
	}
	exists, err := s.admin.UserExists(ctx, userID)
	if err != nil {
		return httpx.Internal(err)
	}
	if !exists {
		return httpx.NotFound("That user does not exist.")
	}

	var expires *time.Time
	if req.Banned != nil && *req.Banned && req.BanDays != nil && *req.BanDays > 0 {
		until := time.Now().AddDate(0, 0, *req.BanDays)
		expires = &until
	}

	if err := s.admin.UpdateUserStatus(ctx, userID, req.Role, req.Banned, req.BanReason, expires); err != nil {
		return translate(err, "That user does not exist.")
	}

	// A ban or a demotion has to take effect immediately, not at session expiry.
	if (req.Banned != nil && *req.Banned) || (req.Role != nil && *req.Role == models.RoleUser) {
		if err := s.admin.RevokeSessions(ctx, userID); err != nil {
			log.Printf("admin: revoke sessions for %s: %v", userID, err)
		}
	}

	action := "user.update"
	switch {
	case req.Banned != nil && *req.Banned:
		action = "user.ban"
	case req.Banned != nil && !*req.Banned:
		action = "user.unban"
	case req.Role != nil:
		action = "user.role." + *req.Role
	}
	s.audit(ctx, viewer.UserID, action, "user", userID, req.BanReason)
	return nil
}

// DeleteUser removes an account and everything it owns.
func (s *AdminService) DeleteUser(ctx context.Context, userID string, reason *string) error {
	if err := s.assertAdmin(ctx); err != nil {
		return err
	}
	viewer := auth.FromContext(ctx)
	if userID == viewer.UserID {
		return httpx.Forbidden("You cannot delete your own account from the admin panel.")
	}

	if err := s.admin.DeleteUser(ctx, userID); err != nil {
		return translate(err, "That user does not exist.")
	}
	s.audit(ctx, viewer.UserID, "user.delete", "user", userID, reason)
	return nil
}

// Report files a moderation report from any signed-in user.
func (s *AdminService) Report(ctx context.Context, req models.ReportRequest) error {
	viewer := auth.FromContext(ctx)
	if viewer == nil {
		return httpx.Unauthorized("Sign in to report content.")
	}
	if errs := req.Validate(); errs.Any() {
		return httpx.Invalid(errs)
	}

	duplicate, err := s.admin.ReportExists(ctx, viewer.UserID, req.TargetType, req.TargetID)
	if err != nil {
		return httpx.Internal(err)
	}
	if duplicate {
		return httpx.Conflict("You already reported this. Our moderators are on it.")
	}

	if err := s.admin.CreateReport(ctx, uuid.NewString(), req, viewer.UserID); err != nil {
		return httpx.Internal(err)
	}
	return nil
}

// ListReports returns the moderation queue.
func (s *AdminService) ListReports(ctx context.Context, status string, page, pageSize int) ([]models.Report, int, error) {
	if err := s.assertAdmin(ctx); err != nil {
		return nil, 0, err
	}
	reports, total, err := s.admin.ListReports(ctx, status, page, pageSize)
	if err != nil {
		return nil, 0, httpx.Internal(err)
	}
	return reports, total, nil
}

// ResolveReport closes or reopens a report.
func (s *AdminService) ResolveReport(ctx context.Context, reportID string, req models.ReportStatusRequest) error {
	if err := s.assertAdmin(ctx); err != nil {
		return err
	}
	if errs := req.Validate(); errs.Any() {
		return httpx.Invalid(errs)
	}
	if err := s.admin.UpdateReportStatus(ctx, reportID, req.Status); err != nil {
		return translate(err, "That report does not exist.")
	}
	s.audit(ctx, auth.UserIDFromContext(ctx), "report."+req.Status, "report", reportID, nil)
	return nil
}

// ListActions returns the audit trail.
func (s *AdminService) ListActions(ctx context.Context, page, pageSize int) ([]models.AuditEntry, int, error) {
	if err := s.assertAdmin(ctx); err != nil {
		return nil, 0, err
	}
	entries, total, err := s.admin.ListActions(ctx, page, pageSize)
	if err != nil {
		return nil, 0, httpx.Internal(err)
	}
	return entries, total, nil
}

func (s *AdminService) assertAdmin(ctx context.Context) error {
	if !auth.FromContext(ctx).IsAdmin() {
		return httpx.Forbidden("Admins only.")
	}
	return nil
}

func (s *AdminService) audit(ctx context.Context, adminID, action, targetType, targetID string, reason *string) {
	if err := s.admin.LogAction(ctx, uuid.NewString(), adminID, action, targetType, targetID, reason); err != nil {
		log.Printf("audit: %v", err)
	}
}

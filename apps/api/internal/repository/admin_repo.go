package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yournote/api/internal/models"
)

// AdminRepository backs the moderation panel: platform stats, the user table,
// the report queue and the audit log.
type AdminRepository struct {
	db *pgxpool.Pool
}

// NewAdminRepository builds an AdminRepository.
func NewAdminRepository(db *pgxpool.Pool) *AdminRepository {
	return &AdminRepository{db: db}
}

// Counters loads every scalar shown on the admin overview in one round trip.
// "Logged in" counts distinct users holding a session that has not expired,
// which is what the panel reports as currently active accounts.
func (r *AdminRepository) Counters(ctx context.Context) (models.AdminStats, error) {
	var s models.AdminStats

	err := r.db.QueryRow(ctx, `
		SELECT
			(SELECT count(*) FROM users),
			(SELECT count(*) FROM users WHERE email_verified = true),
			(SELECT count(*) FROM users WHERE COALESCE(banned, false) = true),
			(SELECT count(*) FROM users WHERE role = 'admin'),
			(SELECT count(*) FROM users WHERE created_at >= date_trunc('day', now())),
			(SELECT count(*) FROM users WHERE created_at >= now() - interval '7 days'),
			(SELECT count(DISTINCT user_id) FROM sessions WHERE expires_at > now()),
			(SELECT count(*) FROM sessions WHERE expires_at > now()),
			(SELECT count(*) FROM notes),
			(SELECT count(*) FROM notes WHERE status = 'published' AND visibility = 'public'),
			(SELECT count(*) FROM notes WHERE status = 'draft'),
			(SELECT count(*) FROM notes WHERE status = 'removed'),
			(SELECT count(*) FROM comments),
			(SELECT count(*) FROM comments WHERE is_deleted = true),
			(SELECT count(*) FROM reactions),
			(SELECT COALESCE(sum(view_count), 0) FROM notes),
			(SELECT count(*) FROM attachments),
			(SELECT COALESCE(sum(bytes), 0) FROM attachments),
			(SELECT count(*) FROM reports WHERE status = 'open')`,
	).Scan(
		&s.TotalUsers, &s.VerifiedUsers, &s.BannedUsers, &s.AdminUsers,
		&s.NewUsersToday, &s.NewUsersThisWeek, &s.LoggedInUsers, &s.ActiveSessions,
		&s.TotalNotes, &s.PublicNotes, &s.DraftNotes, &s.RemovedNotes,
		&s.TotalComments, &s.HiddenComments, &s.TotalReactions, &s.TotalViews,
		&s.Attachments, &s.StorageBytes, &s.OpenReports,
	)
	if err != nil {
		return models.AdminStats{}, fmt.Errorf("load admin counters: %w", err)
	}
	return s, nil
}

// Trend returns a daily count for the last `days` days, with empty days filled
// in as zero so the chart has no gaps.
func (r *AdminRepository) Trend(ctx context.Context, table string, days int) ([]models.DayCount, error) {
	// table is never user input: callers pass a literal.
	if table != "users" && table != "notes" {
		return nil, fmt.Errorf("unsupported trend table %q", table)
	}

	query := fmt.Sprintf(`
		SELECT to_char(day, 'YYYY-MM-DD') AS label, COALESCE(counted.total, 0)
		FROM generate_series(
			date_trunc('day', now()) - make_interval(days => $1 - 1),
			date_trunc('day', now()),
			interval '1 day'
		) AS day
		LEFT JOIN (
			SELECT date_trunc('day', created_at) AS bucket, count(*) AS total
			FROM %s
			WHERE created_at >= date_trunc('day', now()) - make_interval(days => $1 - 1)
			GROUP BY bucket
		) counted ON counted.bucket = day
		ORDER BY day ASC`, table)

	rows, err := r.db.Query(ctx, query, days)
	if err != nil {
		return nil, fmt.Errorf("load %s trend: %w", table, err)
	}
	defer rows.Close()

	trend := make([]models.DayCount, 0, days)
	for rows.Next() {
		var point models.DayCount
		if err := rows.Scan(&point.Date, &point.Count); err != nil {
			return nil, fmt.Errorf("scan trend point: %w", err)
		}
		trend = append(trend, point)
	}
	return trend, rows.Err()
}

// AdminUserFilter pages and filters the user table.
type AdminUserFilter struct {
	Search   string
	Role     string
	Status   string // all | banned | verified | unverified | online
	Page     int
	PageSize int
}

const adminUserColumns = `
	u.id, u.name, u.email, u.image, COALESCE(u.role, 'user'), u.email_verified,
	COALESCE(u.banned, false), u.ban_reason, u.ban_expires, u.created_at,
	COALESCE((SELECT array_agg(DISTINCT a.provider_id) FROM accounts a WHERE a.user_id = u.id), ARRAY[]::text[]),
	(SELECT count(*) FROM notes n WHERE n.author_id = u.id),
	(SELECT count(*) FROM comments c WHERE c.author_id = u.id),
	EXISTS (SELECT 1 FROM sessions s WHERE s.user_id = u.id AND s.expires_at > now()),
	(SELECT max(s.updated_at) FROM sessions s WHERE s.user_id = u.id)`

func scanAdminUser(row pgx.Row) (models.AdminUser, error) {
	var u models.AdminUser
	err := row.Scan(
		&u.ID, &u.Name, &u.Email, &u.Image, &u.Role, &u.EmailVerified,
		&u.Banned, &u.BanReason, &u.BanExpires, &u.CreatedAt,
		&u.Providers, &u.NoteCount, &u.CommentCount, &u.ActiveSession, &u.LastSeenAt,
	)
	if err != nil {
		return models.AdminUser{}, err
	}
	if u.Providers == nil {
		u.Providers = []string{}
	}
	return u, nil
}

// ListUsers returns one page of the admin user table.
func (r *AdminRepository) ListUsers(ctx context.Context, f AdminUserFilter) ([]models.AdminUser, int, error) {
	var (
		where []string
		args  []any
	)
	next := func(value any) string {
		args = append(args, value)
		return fmt.Sprintf("$%d", len(args))
	}

	if f.Search != "" {
		pattern := next("%" + f.Search + "%")
		where = append(where, fmt.Sprintf("(u.name ILIKE %[1]s OR u.email ILIKE %[1]s)", pattern))
	}
	if f.Role != "" {
		where = append(where, "COALESCE(u.role, 'user') = "+next(f.Role))
	}
	switch f.Status {
	case "banned":
		where = append(where, "COALESCE(u.banned, false) = true")
	case "verified":
		where = append(where, "u.email_verified = true")
	case "unverified":
		where = append(where, "u.email_verified = false")
	case "online":
		where = append(where, "EXISTS (SELECT 1 FROM sessions s WHERE s.user_id = u.id AND s.expires_at > now())")
	}

	clause := ""
	if len(where) > 0 {
		clause = " WHERE " + strings.Join(where, " AND ")
	}

	var total int
	if err := r.db.QueryRow(ctx, "SELECT count(*) FROM users u"+clause, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count users: %w", err)
	}
	if total == 0 {
		return []models.AdminUser{}, 0, nil
	}

	query := fmt.Sprintf("SELECT %s FROM users u%s ORDER BY u.created_at DESC LIMIT $%d OFFSET $%d",
		adminUserColumns, clause, len(args)+1, len(args)+2)
	args = append(args, f.PageSize, (f.Page-1)*f.PageSize)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list users: %w", err)
	}
	defer rows.Close()

	users := make([]models.AdminUser, 0, f.PageSize)
	for rows.Next() {
		user, err := scanAdminUser(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scan admin user: %w", err)
		}
		users = append(users, user)
	}
	return users, total, rows.Err()
}

// RecentUsers returns the newest sign-ups for the dashboard.
func (r *AdminRepository) RecentUsers(ctx context.Context, limit int) ([]models.AdminUser, error) {
	query := fmt.Sprintf("SELECT %s FROM users u ORDER BY u.created_at DESC LIMIT $1", adminUserColumns)

	rows, err := r.db.Query(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("load recent users: %w", err)
	}
	defer rows.Close()

	users := make([]models.AdminUser, 0, limit)
	for rows.Next() {
		user, err := scanAdminUser(rows)
		if err != nil {
			return nil, fmt.Errorf("scan recent user: %w", err)
		}
		users = append(users, user)
	}
	return users, rows.Err()
}

// UpdateUserStatus applies a role change, a ban or an unban.
func (r *AdminRepository) UpdateUserStatus(ctx context.Context, userID string, role *string, banned *bool, reason *string, expires *time.Time) error {
	sets := []string{"updated_at = now()"}
	args := []any{userID}
	next := func(value any) string {
		args = append(args, value)
		return fmt.Sprintf("$%d", len(args))
	}

	if role != nil {
		sets = append(sets, "role = "+next(*role))
	}
	if banned != nil {
		sets = append(sets, "banned = "+next(*banned))
		if *banned {
			sets = append(sets, "ban_reason = "+next(reason))
			sets = append(sets, "ban_expires = "+next(expires))
		} else {
			sets = append(sets, "ban_reason = NULL", "ban_expires = NULL")
		}
	}

	query := "UPDATE users SET " + strings.Join(sets, ", ") + " WHERE id = $1"
	tag, err := r.db.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("update user status: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// RevokeSessions signs a user out everywhere, which is what a ban must do.
func (r *AdminRepository) RevokeSessions(ctx context.Context, userID string) error {
	if _, err := r.db.Exec(ctx, "DELETE FROM sessions WHERE user_id = $1", userID); err != nil {
		return fmt.Errorf("revoke sessions: %w", err)
	}
	return nil
}

// DeleteUser removes an account. Notes, comments and reactions cascade.
func (r *AdminRepository) DeleteUser(ctx context.Context, userID string) error {
	tag, err := r.db.Exec(ctx, "DELETE FROM users WHERE id = $1", userID)
	if err != nil {
		return fmt.Errorf("delete user: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// UserExists reports whether an account is present.
func (r *AdminRepository) UserExists(ctx context.Context, userID string) (bool, error) {
	var exists bool
	if err := r.db.QueryRow(ctx,
		"SELECT EXISTS (SELECT 1 FROM users WHERE id = $1)", userID).Scan(&exists); err != nil {
		return false, fmt.Errorf("check user: %w", err)
	}
	return exists, nil
}

// CreateReport files a moderation report.
func (r *AdminRepository) CreateReport(ctx context.Context, id string, req models.ReportRequest, reporterID string) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO reports (id, target_type, target_id, reporter_id, reason, details, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, 'open', now())`,
		id, req.TargetType, req.TargetID, reporterID, req.Reason, req.Details)
	if err != nil {
		return fmt.Errorf("create report: %w", err)
	}
	return nil
}

// ListReports returns the moderation queue, newest first, with a short preview
// and a deep link resolved for each reported item.
func (r *AdminRepository) ListReports(ctx context.Context, status string, page, pageSize int) ([]models.Report, int, error) {
	var (
		where []string
		args  []any
	)
	if status != "" && status != "all" {
		args = append(args, status)
		where = append(where, "r.status = $1")
	}
	clause := ""
	if len(where) > 0 {
		clause = " WHERE " + strings.Join(where, " AND ")
	}

	from := " FROM reports r JOIN users u ON u.id = r.reporter_id" + clause

	var total int
	if err := r.db.QueryRow(ctx, "SELECT count(*)"+from, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count reports: %w", err)
	}
	if total == 0 {
		return []models.Report{}, 0, nil
	}

	query := fmt.Sprintf(`
		SELECT r.id, r.target_type, r.target_id, r.reason, r.details, r.status,
		       r.created_at, r.resolved_at,
		       u.id, u.name, u.image, COALESCE(u.role, 'user'),
		       CASE r.target_type
		            WHEN 'comment' THEN (SELECT left(c.content, 180) FROM comments c WHERE c.id = r.target_id)
		            WHEN 'note' THEN (SELECT n.title FROM notes n WHERE n.id = r.target_id)
		       END,
		       CASE r.target_type
		            WHEN 'comment' THEN (SELECT n.slug FROM notes n JOIN comments c ON c.note_id = n.id WHERE c.id = r.target_id)
		            WHEN 'note' THEN (SELECT n.slug FROM notes n WHERE n.id = r.target_id)
		       END
		%s ORDER BY r.created_at DESC LIMIT $%d OFFSET $%d`,
		from, len(args)+1, len(args)+2)
	args = append(args, pageSize, (page-1)*pageSize)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list reports: %w", err)
	}
	defer rows.Close()

	reports := make([]models.Report, 0, pageSize)
	for rows.Next() {
		var report models.Report
		err := rows.Scan(
			&report.ID, &report.TargetType, &report.TargetID, &report.Reason,
			&report.Details, &report.Status, &report.CreatedAt, &report.ResolvedAt,
			&report.Reporter.ID, &report.Reporter.Name, &report.Reporter.Image,
			&report.Reporter.Role, &report.Preview, &report.Link,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scan report: %w", err)
		}
		reports = append(reports, report)
	}
	return reports, total, rows.Err()
}

// UpdateReportStatus resolves or dismisses a report.
func (r *AdminRepository) UpdateReportStatus(ctx context.Context, reportID, status string) error {
	resolvedAt := "now()"
	if status == models.ReportOpen {
		resolvedAt = "NULL"
	}

	tag, err := r.db.Exec(ctx,
		"UPDATE reports SET status = $2, resolved_at = "+resolvedAt+" WHERE id = $1",
		reportID, status)
	if err != nil {
		return fmt.Errorf("update report: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// LogAction appends to the audit trail. Audit failures never block the action
// that was already applied, so callers log the error rather than surfacing it.
func (r *AdminRepository) LogAction(ctx context.Context, id, adminID, action, targetType, targetID string, reason *string) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO admin_actions (id, admin_id, action, target_type, target_id, reason, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, now())`,
		id, adminID, action, targetType, targetID, reason)
	if err != nil {
		return fmt.Errorf("write audit entry: %w", err)
	}
	return nil
}

// ListActions returns the most recent moderation actions.
func (r *AdminRepository) ListActions(ctx context.Context, page, pageSize int) ([]models.AuditEntry, int, error) {
	var total int
	if err := r.db.QueryRow(ctx, "SELECT count(*) FROM admin_actions").Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count audit entries: %w", err)
	}
	if total == 0 {
		return []models.AuditEntry{}, 0, nil
	}

	rows, err := r.db.Query(ctx, `
		SELECT a.id, a.action, a.target_type, a.target_id, a.reason, a.created_at,
		       u.id, u.name, u.image, COALESCE(u.role, 'user')
		FROM admin_actions a
		JOIN users u ON u.id = a.admin_id
		ORDER BY a.created_at DESC
		LIMIT $1 OFFSET $2`, pageSize, (page-1)*pageSize)
	if err != nil {
		return nil, 0, fmt.Errorf("list audit entries: %w", err)
	}
	defer rows.Close()

	entries := make([]models.AuditEntry, 0, pageSize)
	for rows.Next() {
		var entry models.AuditEntry
		err := rows.Scan(
			&entry.ID, &entry.Action, &entry.TargetType, &entry.TargetID,
			&entry.Reason, &entry.CreatedAt,
			&entry.Admin.ID, &entry.Admin.Name, &entry.Admin.Image, &entry.Admin.Role,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scan audit entry: %w", err)
		}
		entries = append(entries, entry)
	}
	return entries, total, rows.Err()
}

// ReportExists guards against a user filing the same report twice.
func (r *AdminRepository) ReportExists(ctx context.Context, reporterID, targetType, targetID string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM reports
			WHERE reporter_id = $1 AND target_type = $2 AND target_id = $3 AND status = 'open'
		)`, reporterID, targetType, targetID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check duplicate report: %w", err)
	}
	return exists, nil
}

// ErrNoRowsIsNotFound converts a pgx no-rows error into ErrNotFound.
func ErrNoRowsIsNotFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

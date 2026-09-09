package models

import "time"

// Report target types and lifecycle states.
const (
	TargetNote    = "note"
	TargetComment = "comment"

	ReportOpen      = "open"
	ReportResolved  = "resolved"
	ReportDismissed = "dismissed"
)

// DayCount is one bucket of a time series shown on the admin dashboard.
type DayCount struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

// AdminStats is everything the admin overview renders.
type AdminStats struct {
	TotalUsers       int `json:"totalUsers"`
	VerifiedUsers    int `json:"verifiedUsers"`
	BannedUsers      int `json:"bannedUsers"`
	AdminUsers       int `json:"adminUsers"`
	NewUsersToday    int `json:"newUsersToday"`
	NewUsersThisWeek int `json:"newUsersThisWeek"`
	// LoggedInUsers counts distinct users with a session that has not expired.
	LoggedInUsers  int `json:"loggedInUsers"`
	ActiveSessions int `json:"activeSessions"`

	TotalNotes     int   `json:"totalNotes"`
	PublicNotes    int   `json:"publicNotes"`
	DraftNotes     int   `json:"draftNotes"`
	RemovedNotes   int   `json:"removedNotes"`
	TotalComments  int   `json:"totalComments"`
	HiddenComments int   `json:"hiddenComments"`
	TotalReactions int   `json:"totalReactions"`
	TotalViews     int   `json:"totalViews"`
	Attachments    int   `json:"attachments"`
	StorageBytes   int64 `json:"storageBytes"`
	OpenReports    int   `json:"openReports"`

	SignupTrend []DayCount  `json:"signupTrend"`
	NoteTrend   []DayCount  `json:"noteTrend"`
	TopNotes    []Note      `json:"topNotes"`
	RecentUsers []AdminUser `json:"recentUsers"`
}

// AdminComment is a comment row in the moderation queue, with the note it
// belongs to so an admin has context before removing it.
type AdminComment struct {
	Comment
	NoteTitle string `json:"noteTitle"`
	NoteSlug  string `json:"noteSlug"`
}

// Report is a user-submitted moderation request.
type Report struct {
	ID         string      `json:"id"`
	TargetType string      `json:"targetType"`
	TargetID   string      `json:"targetId"`
	Reason     string      `json:"reason"`
	Details    *string     `json:"details"`
	Status     string      `json:"status"`
	CreatedAt  time.Time   `json:"createdAt"`
	ResolvedAt *time.Time  `json:"resolvedAt"`
	Reporter   UserSummary `json:"reporter"`
	// Preview is a short excerpt of the reported content, resolved at read time.
	Preview *string `json:"preview"`
	Link    *string `json:"link"`
}

// ReportRequest is the payload a user submits when reporting content.
type ReportRequest struct {
	TargetType string  `json:"targetType"`
	TargetID   string  `json:"targetId"`
	Reason     string  `json:"reason"`
	Details    *string `json:"details"`
}

// Validate normalises and checks a report payload.
func (r *ReportRequest) Validate() ValidationErrors {
	errs := ValidationErrors{}
	r.TargetType = Trim(r.TargetType)
	r.TargetID = Trim(r.TargetID)
	r.Reason = Trim(r.Reason)
	r.Details = TrimPtr(r.Details)

	if r.TargetType != TargetNote && r.TargetType != TargetComment {
		errs.Add("targetType", "Reports must target a note or a comment.")
	}
	if r.TargetID == "" {
		errs.Add("targetId", "Missing the reported item.")
	}
	if r.Reason == "" {
		errs.Add("reason", "Tell us what is wrong.")
	} else if Length(r.Reason) > 120 {
		errs.Add("reason", "Keep the reason under 120 characters.")
	}
	if r.Details != nil && Length(*r.Details) > 500 {
		errs.Add("details", "Keep the details under 500 characters.")
	}
	return errs
}

// ReportStatusRequest resolves or dismisses a report.
type ReportStatusRequest struct {
	Status string `json:"status"`
}

// Validate checks the requested report status.
func (r *ReportStatusRequest) Validate() ValidationErrors {
	errs := ValidationErrors{}
	r.Status = Trim(r.Status)
	if r.Status != ReportResolved && r.Status != ReportDismissed && r.Status != ReportOpen {
		errs.Add("status", "Status must be open, resolved or dismissed.")
	}
	return errs
}

// AuditEntry is one row of the admin action log.
type AuditEntry struct {
	ID         string      `json:"id"`
	Action     string      `json:"action"`
	TargetType string      `json:"targetType"`
	TargetID   string      `json:"targetId"`
	Reason     *string     `json:"reason"`
	CreatedAt  time.Time   `json:"createdAt"`
	Admin      UserSummary `json:"admin"`
}

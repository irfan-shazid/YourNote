package models

import "time"

// Note visibility values.
const (
	VisibilityPublic   = "public"
	VisibilityUnlisted = "unlisted"
	VisibilityPrivate  = "private"
)

// Note status values. "removed" is a soft delete performed by a moderator.
const (
	StatusPublished = "published"
	StatusDraft     = "draft"
	StatusRemoved   = "removed"
)

var (
	visibilities = []string{VisibilityPublic, VisibilityUnlisted, VisibilityPrivate}
	statuses     = []string{StatusPublished, StatusDraft}
)

// Limits applied to note input.
const (
	MaxTitleLength   = 140
	MaxSummaryLength = 300
	MaxContentLength = 100000
	MaxSubjectLength = 60
	MaxTags          = 8
	MaxTagLength     = 24
	MaxAttachments   = 12
)

// Attachment is one Cloudinary asset belonging to a note.
type Attachment struct {
	ID           string    `json:"id"`
	NoteID       string    `json:"noteId"`
	URL          string    `json:"url"`
	SecureURL    string    `json:"secureUrl"`
	PublicID     string    `json:"publicId"`
	ResourceType string    `json:"resourceType"`
	Format       *string   `json:"format"`
	OriginalName *string   `json:"originalName"`
	Bytes        int64     `json:"bytes"`
	Width        *int      `json:"width"`
	Height       *int      `json:"height"`
	Pages        *int      `json:"pages"`
	Position     int       `json:"position"`
	CreatedAt    time.Time `json:"createdAt"`
}

// IsPDF reports whether the attachment should render in the PDF viewer.
func (a Attachment) IsPDF() bool { return a.Format != nil && *a.Format == "pdf" }

// NoteStats are the aggregate counters shown on a note card.
type NoteStats struct {
	Views          int            `json:"views"`
	Comments       int            `json:"comments"`
	Reactions      int            `json:"reactions"`
	Bookmarks      int            `json:"bookmarks"`
	ReactionCounts map[string]int `json:"reactionCounts"`
}

// NoteViewer describes the current viewer's relationship to a note.
type NoteViewer struct {
	Reactions  []string `json:"reactions"`
	Bookmarked bool     `json:"bookmarked"`
	CanEdit    bool     `json:"canEdit"`
}

// Note is the full domain object. Content is only populated by detail queries.
type Note struct {
	ID          string       `json:"id"`
	Title       string       `json:"title"`
	Slug        string       `json:"slug"`
	Summary     *string      `json:"summary"`
	Content     string       `json:"content,omitempty"`
	Subject     *string      `json:"subject"`
	Tags        []string     `json:"tags"`
	CoverImage  *string      `json:"coverImage"`
	Visibility  string       `json:"visibility"`
	Status      string       `json:"status"`
	CreatedAt   time.Time    `json:"createdAt"`
	UpdatedAt   time.Time    `json:"updatedAt"`
	Author      UserSummary  `json:"author"`
	Attachments []Attachment `json:"attachments"`
	Stats       NoteStats    `json:"stats"`
	Viewer      NoteViewer   `json:"viewer"`
}

// AttachmentInput is an uploaded Cloudinary asset submitted with a note.
type AttachmentInput struct {
	URL          string  `json:"url"`
	SecureURL    string  `json:"secureUrl"`
	PublicID     string  `json:"publicId"`
	ResourceType string  `json:"resourceType"`
	Format       *string `json:"format"`
	OriginalName *string `json:"originalName"`
	Bytes        int64   `json:"bytes"`
	Width        *int    `json:"width"`
	Height       *int    `json:"height"`
	Pages        *int    `json:"pages"`
}

// NoteRequest is the payload for creating or replacing a note.
type NoteRequest struct {
	Title       string            `json:"title"`
	Summary     *string           `json:"summary"`
	Content     string            `json:"content"`
	Subject     *string           `json:"subject"`
	Tags        []string          `json:"tags"`
	CoverImage  *string           `json:"coverImage"`
	Visibility  string            `json:"visibility"`
	Status      string            `json:"status"`
	Attachments []AttachmentInput `json:"attachments"`
}

// Validate normalises and checks a note payload.
func (n *NoteRequest) Validate() ValidationErrors {
	errs := ValidationErrors{}

	n.Title = Trim(n.Title)
	n.Content = Trim(n.Content)
	n.Summary = TrimPtr(n.Summary)
	n.Subject = TrimPtr(n.Subject)
	n.CoverImage = TrimPtr(n.CoverImage)

	switch {
	case n.Title == "":
		errs.Add("title", "Give your note a title.")
	case Length(n.Title) < 3:
		errs.Add("title", "Titles need at least 3 characters.")
	case Length(n.Title) > MaxTitleLength:
		errs.Add("title", "Titles are limited to 140 characters.")
	}

	switch {
	case n.Content == "":
		errs.Add("content", "A note needs some content.")
	case Length(n.Content) > MaxContentLength:
		errs.Add("content", "This note is too long to save.")
	}

	if n.Summary != nil && Length(*n.Summary) > MaxSummaryLength {
		errs.Add("summary", "Summaries are limited to 300 characters.")
	}
	if n.Subject != nil && Length(*n.Subject) > MaxSubjectLength {
		errs.Add("subject", "Subjects are limited to 60 characters.")
	}

	n.Tags = NormaliseTags(n.Tags)
	if len(n.Tags) > MaxTags {
		errs.Add("tags", "Use at most 8 tags.")
	}
	for _, tag := range n.Tags {
		if Length(tag) > MaxTagLength {
			errs.Add("tags", "Each tag is limited to 24 characters.")
			break
		}
	}

	if n.Visibility == "" {
		n.Visibility = VisibilityPublic
	}
	if !Contains(visibilities, n.Visibility) {
		errs.Add("visibility", "Choose public, unlisted or private.")
	}

	if n.Status == "" {
		n.Status = StatusPublished
	}
	if !Contains(statuses, n.Status) {
		errs.Add("status", "Choose published or draft.")
	}

	if len(n.Attachments) > MaxAttachments {
		errs.Add("attachments", "Attach at most 12 files to one note.")
	}
	for _, a := range n.Attachments {
		if a.SecureURL == "" || a.PublicID == "" {
			errs.Add("attachments", "One of the uploads did not complete. Remove it and try again.")
			break
		}
	}

	return errs
}

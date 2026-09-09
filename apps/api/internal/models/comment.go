package models

import "time"

// MaxCommentLength bounds a single comment body.
const MaxCommentLength = 2000

// Comment is one entry in a note's discussion. Replies are nested one level
// deep, which keeps threads readable without an unbounded tree.
type Comment struct {
	ID        string      `json:"id"`
	NoteID    string      `json:"noteId"`
	ParentID  *string     `json:"parentId"`
	Content   string      `json:"content"`
	IsDeleted bool        `json:"isDeleted"`
	CreatedAt time.Time   `json:"createdAt"`
	UpdatedAt time.Time   `json:"updatedAt"`
	Author    UserSummary `json:"author"`
	Replies   []Comment   `json:"replies"`
	CanEdit   bool        `json:"canEdit"`
	CanDelete bool        `json:"canDelete"`
}

// CommentRequest is the payload for posting or editing a comment.
type CommentRequest struct {
	Content  string  `json:"content"`
	ParentID *string `json:"parentId"`
}

// Validate normalises and checks a comment payload.
func (c *CommentRequest) Validate() ValidationErrors {
	errs := ValidationErrors{}
	c.Content = Trim(c.Content)
	c.ParentID = TrimPtr(c.ParentID)

	switch {
	case c.Content == "":
		errs.Add("content", "Write something before posting.")
	case Length(c.Content) > MaxCommentLength:
		errs.Add("content", "Comments are limited to 2000 characters.")
	}
	return errs
}

// ModerationRequest carries the optional reason an admin gives for removing
// content. The reason is stored on the record and in the audit log.
type ModerationRequest struct {
	Reason *string `json:"reason"`
}

// Validate checks the moderation reason length.
func (m *ModerationRequest) Validate() ValidationErrors {
	errs := ValidationErrors{}
	m.Reason = TrimPtr(m.Reason)
	if m.Reason != nil && Length(*m.Reason) > 300 {
		errs.Add("reason", "Keep the reason under 300 characters.")
	}
	return errs
}

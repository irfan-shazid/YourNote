package models

import "time"

// Profile is a public author page.
type Profile struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Image     *string   `json:"image"`
	Bio       *string   `json:"bio"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"createdAt"`
	NoteCount int       `json:"noteCount"`
	Reactions int       `json:"reactionsReceived"`
	Views     int       `json:"viewsReceived"`
}

// ProfileRequest updates the fields a user controls about themselves.
type ProfileRequest struct {
	Name string  `json:"name"`
	Bio  *string `json:"bio"`
}

// Validate normalises and checks a profile payload.
func (p *ProfileRequest) Validate() ValidationErrors {
	errs := ValidationErrors{}
	p.Name = Trim(p.Name)
	p.Bio = TrimPtr(p.Bio)

	switch {
	case p.Name == "":
		errs.Add("name", "Your name cannot be empty.")
	case Length(p.Name) < 2:
		errs.Add("name", "Names need at least 2 characters.")
	case Length(p.Name) > 60:
		errs.Add("name", "Names are limited to 60 characters.")
	}
	if p.Bio != nil && Length(*p.Bio) > 280 {
		errs.Add("bio", "Bios are limited to 280 characters.")
	}
	return errs
}

// AdminUser is a row in the admin user table.
type AdminUser struct {
	ID            string     `json:"id"`
	Name          string     `json:"name"`
	Email         string     `json:"email"`
	Image         *string    `json:"image"`
	Role          string     `json:"role"`
	EmailVerified bool       `json:"emailVerified"`
	Banned        bool       `json:"banned"`
	BanReason     *string    `json:"banReason"`
	BanExpires    *time.Time `json:"banExpires"`
	Providers     []string   `json:"providers"`
	NoteCount     int        `json:"noteCount"`
	CommentCount  int        `json:"commentCount"`
	ActiveSession bool       `json:"activeSession"`
	LastSeenAt    *time.Time `json:"lastSeenAt"`
	CreatedAt     time.Time  `json:"createdAt"`
}

// UserStatusRequest is the admin action that bans, unbans or re-roles a user.
type UserStatusRequest struct {
	Role      *string `json:"role"`
	Banned    *bool   `json:"banned"`
	BanReason *string `json:"banReason"`
	// BanDays optionally expires the ban; 0 or nil means permanent.
	BanDays *int `json:"banDays"`
}

// Validate checks an admin user-status payload.
func (u *UserStatusRequest) Validate() ValidationErrors {
	errs := ValidationErrors{}
	u.Role = TrimPtr(u.Role)
	u.BanReason = TrimPtr(u.BanReason)

	if u.Role == nil && u.Banned == nil {
		errs.Add("role", "Nothing to update.")
	}
	if u.Role != nil && *u.Role != RoleUser && *u.Role != RoleAdmin {
		errs.Add("role", "Role must be user or admin.")
	}
	if u.BanReason != nil && Length(*u.BanReason) > 300 {
		errs.Add("banReason", "Keep the reason under 300 characters.")
	}
	if u.BanDays != nil && (*u.BanDays < 0 || *u.BanDays > 3650) {
		errs.Add("banDays", "Choose between 0 and 3650 days.")
	}
	return errs
}

// Role constants duplicated from the auth package to keep models dependency
// free; both mirror the Better Auth admin plugin values.
const (
	RoleUser  = "user"
	RoleAdmin = "admin"
)

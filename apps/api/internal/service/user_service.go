package service

import (
	"context"

	"github.com/yournote/api/internal/auth"
	"github.com/yournote/api/internal/httpx"
	"github.com/yournote/api/internal/models"
	"github.com/yournote/api/internal/repository"
)

// UserService exposes public profiles and the caller's own account.
type UserService struct {
	users *repository.UserRepository
}

// NewUserService builds a UserService.
func NewUserService(users *repository.UserRepository) *UserService {
	return &UserService{users: users}
}

// Profile returns a public author page.
func (s *UserService) Profile(ctx context.Context, userID string) (*models.Profile, error) {
	profile, err := s.users.Profile(ctx, userID)
	if err != nil {
		return nil, translate(err, "That profile does not exist.")
	}
	return profile, nil
}

// UpdateProfile saves the caller's own name and bio.
func (s *UserService) UpdateProfile(ctx context.Context, req models.ProfileRequest) (*models.Profile, error) {
	viewer := auth.FromContext(ctx)
	if viewer == nil {
		return nil, httpx.Unauthorized("Sign in to update your profile.")
	}
	if errs := req.Validate(); errs.Any() {
		return nil, httpx.Invalid(errs)
	}

	if err := s.users.UpdateProfile(ctx, viewer.UserID, req.Name, req.Bio); err != nil {
		return nil, translate(err, "That profile does not exist.")
	}
	return s.Profile(ctx, viewer.UserID)
}

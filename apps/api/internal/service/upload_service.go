package service

import (
	"context"

	"github.com/yournote/api/internal/auth"
	"github.com/yournote/api/internal/cloudinary"
	"github.com/yournote/api/internal/httpx"
)

// UploadService hands out short-lived Cloudinary upload signatures. The API
// secret never leaves the server; the browser uploads straight to Cloudinary
// with the signature it is given, so large PDFs never pass through this API.
type UploadService struct {
	assets *cloudinary.Client
}

// NewUploadService builds an UploadService. A nil client means uploads are
// disabled, which is reported to the caller as a clear 503-style error.
func NewUploadService(assets *cloudinary.Client) *UploadService {
	return &UploadService{assets: assets}
}

// Signature issues an upload signature scoped to the caller's own folder.
func (s *UploadService) Signature(ctx context.Context) (*cloudinary.Signature, error) {
	viewer := auth.FromContext(ctx)
	if viewer == nil {
		return nil, httpx.Unauthorized("Sign in to upload files.")
	}
	if s.assets == nil {
		return nil, httpx.BadRequest("File uploads are not configured on this server.")
	}

	signature := s.assets.SignUpload(viewer.UserID)
	return &signature, nil
}

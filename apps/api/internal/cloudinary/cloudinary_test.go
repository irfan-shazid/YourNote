package cloudinary

import (
	"crypto/sha1"
	"encoding/hex"
	"strings"
	"testing"
)

// TestSignUsesCloudinaryCanonicalForm pins the exact string Cloudinary hashes:
// parameters sorted by key, joined with "&", then the API secret appended.
// Getting the ordering wrong produces uploads that fail only at runtime.
func TestSignUsesCloudinaryCanonicalForm(t *testing.T) {
	client := New("demo-cloud", "key-1", "secret-1", "yournote")

	got := client.sign(map[string]string{
		"timestamp": "1700000000",
		"folder":    "yournote/user-1",
	})

	expected := sha1.Sum([]byte("folder=yournote/user-1&timestamp=1700000000secret-1"))
	if want := hex.EncodeToString(expected[:]); got != want {
		t.Fatalf("sign() = %q, want %q", got, want)
	}
}

func TestSignUploadScopesFolderToTheUser(t *testing.T) {
	client := New("demo-cloud", "key-1", "secret-1", "yournote")

	signature := client.SignUpload("user-42")

	if signature.Folder != "yournote/user-42" {
		t.Errorf("Folder = %q, want the upload scoped to the user", signature.Folder)
	}
	if signature.APIKey != "key-1" || signature.CloudName != "demo-cloud" {
		t.Error("SignUpload did not pass the public credentials through")
	}
	if strings.Contains(signature.UploadURL, "secret-1") {
		t.Error("the API secret must never appear in the upload URL")
	}
	if !strings.HasSuffix(signature.UploadURL, "/demo-cloud/auto/upload") {
		t.Errorf("UploadURL = %q, want the auto resource endpoint so PDFs and images both work", signature.UploadURL)
	}
	if signature.Timestamp == 0 || signature.Signature == "" {
		t.Error("SignUpload returned an incomplete signature")
	}
}

// Two users must never be able to sign an upload into each other's folder.
func TestSignUploadIsolatesUsers(t *testing.T) {
	client := New("demo-cloud", "key-1", "secret-1", "yournote")

	first := client.SignUpload("user-a")
	second := client.SignUpload("user-b")

	if first.Folder == second.Folder {
		t.Fatal("two users received the same upload folder")
	}
}

package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestExtractTokenSplitsSignature(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(&http.Cookie{Name: "better-auth.session_token", Value: "abc123.signaturepart"})

	token, signature := ExtractToken(req)
	if token != "abc123" || signature != "signaturepart" {
		t.Fatalf("ExtractToken() = (%q, %q), want (abc123, signaturepart)", token, signature)
	}
}

func TestExtractTokenPrefersSecureCookie(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(&http.Cookie{Name: "better-auth.session_token", Value: "insecure.sig"})
	req.AddCookie(&http.Cookie{Name: "__Secure-better-auth.session_token", Value: "secure.sig"})

	if token, _ := ExtractToken(req); token != "secure" {
		t.Errorf("ExtractToken() = %q, want the __Secure- cookie to win", token)
	}
}

func TestExtractTokenFallsBackToBearer(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer plain-token")

	if token, signature := ExtractToken(req); token != "plain-token" || signature != "" {
		t.Errorf("ExtractToken() = (%q, %q), want (plain-token, )", token, signature)
	}
}

func TestExtractTokenIsEmptyWithoutCredentials(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	if token, _ := ExtractToken(req); token != "" {
		t.Errorf("ExtractToken() = %q, want an empty token", token)
	}
}

func TestIdentityPermissions(t *testing.T) {
	admin := &Identity{UserID: "admin-1", Role: RoleAdmin}
	author := &Identity{UserID: "user-1", Role: RoleUser}

	if !admin.IsAdmin() || author.IsAdmin() {
		t.Error("IsAdmin did not follow the role")
	}
	if !author.Owns("user-1") || author.Owns("user-2") {
		t.Error("Owns should be true only for the owner")
	}
	if !admin.Owns("user-2") {
		t.Error("an admin should pass the ownership check")
	}

	// A nil identity is the anonymous caller and may never own anything.
	var anonymous *Identity
	if anonymous.Owns("user-1") || anonymous.IsAdmin() || anonymous.IsActive() {
		t.Error("an anonymous caller should have no permissions")
	}
}

func TestIdentityBanExpiry(t *testing.T) {
	past := time.Now().Add(-time.Hour)
	future := time.Now().Add(time.Hour)

	expired := &Identity{Banned: true, BanExpires: &past}
	if !expired.IsActive() {
		t.Error("a ban that has expired should no longer block the user")
	}

	active := &Identity{Banned: true, BanExpires: &future}
	if active.IsActive() {
		t.Error("a ban that is still running should block the user")
	}

	permanent := &Identity{Banned: true}
	if permanent.IsActive() {
		t.Error("a permanent ban should block the user")
	}
}

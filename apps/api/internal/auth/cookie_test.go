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

// The following vectors were captured from a live Better Auth 1.7 sign-in and
// reproduced with node's crypto, so they pin this implementation to the one
// that actually issues the cookies rather than to an assumption about it.
const (
	vectorSecret = "test-secret-value-for-signature-vector"
	vectorToken  = "JlJrU2FAI0QgK8S2f930qbIYJeDudFLJ"
	// Standard base64 with padding, which is what Better Auth 1.7 emits.
	vectorSignature = "wcZN5a/LKaNudJNZFKjye60dysVm4o7xqhCdnyjrbLw="
	// Unpadded base64url, emitted by earlier releases.
	vectorSignatureLegacy = "wcZN5a_LKaNudJNZFKjye60dysVm4o7xqhCdnyjrbLw"
)

func TestVerifySignatureAcceptsBetterAuthCookie(t *testing.T) {
	if !VerifySignature(vectorSecret, vectorToken, vectorSignature) {
		t.Error("a genuine Better Auth 1.7 signature was rejected")
	}
	if !VerifySignature(vectorSecret, vectorToken, vectorSignatureLegacy) {
		t.Error("the legacy base64url signature was rejected")
	}
}

func TestVerifySignatureRejectsForgeries(t *testing.T) {
	cases := map[string][3]string{
		"wrong secret":    {"another-secret", vectorToken, vectorSignature},
		"wrong token":     {vectorSecret, "someoneelsestoken", vectorSignature},
		"tampered sig":    {vectorSecret, vectorToken, "xcZN5a/LKaNudJNZFKjye60dysVm4o7xqhCdnyjrbLw="},
		"empty signature": {vectorSecret, vectorToken, ""},
		"empty secret":    {"", vectorToken, vectorSignature},
	}

	for name, args := range cases {
		t.Run(name, func(t *testing.T) {
			if VerifySignature(args[0], args[1], args[2]) {
				t.Error("an invalid signature was accepted")
			}
		})
	}
}

// The percent-encoded cookie a browser actually sends must yield the exact
// token stored in the sessions table, and a signature that still verifies.
func TestExtractTokenHandlesEncodedRealCookie(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(&http.Cookie{
		Name:  "better-auth.session_token",
		Value: vectorToken + ".wcZN5a%2FLKaNudJNZFKjye60dysVm4o7xqhCdnyjrbLw%3D",
	})

	token, signature := ExtractToken(req)

	if token != vectorToken {
		t.Fatalf("token = %q, want the value stored in the sessions table", token)
	}
	if !VerifySignature(vectorSecret, token, signature) {
		t.Errorf("signature %q from the encoded cookie did not verify", signature)
	}
}

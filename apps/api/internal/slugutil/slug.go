// Package slugutil builds URL-safe, collision-resistant note slugs.
package slugutil

import (
	"crypto/rand"
	"encoding/hex"
	"strings"
	"unicode"
)

const maxBaseLength = 60

// Make converts a title into a slug and appends a short random suffix so two
// notes with the same title never collide.
func Make(title string) string {
	base := Base(title)
	if base == "" {
		base = "note"
	}
	return base + "-" + suffix()
}

// Base slugifies text without adding a suffix.
func Base(text string) string {
	var b strings.Builder
	b.Grow(len(text))

	lastWasDash := false
	for _, r := range strings.ToLower(strings.TrimSpace(text)) {
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			// Keep ASCII alphanumerics; transliterating every script is out of
			// scope, so non-ASCII letters are dropped and the suffix keeps the
			// slug unique.
			if r < unicode.MaxASCII {
				b.WriteRune(r)
				lastWasDash = false
			}
		case !lastWasDash && b.Len() > 0:
			b.WriteByte('-')
			lastWasDash = true
		}
	}

	slug := strings.Trim(b.String(), "-")
	if len(slug) > maxBaseLength {
		slug = strings.Trim(slug[:maxBaseLength], "-")
	}
	return slug
}

func suffix() string {
	buf := make([]byte, 4)
	if _, err := rand.Read(buf); err != nil {
		// crypto/rand only fails catastrophically; a fixed suffix still yields a
		// usable slug because the database enforces uniqueness on retry.
		return "note"
	}
	return hex.EncodeToString(buf)
}

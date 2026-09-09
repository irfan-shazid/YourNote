// Package models holds the domain types and the request payloads the API
// accepts, together with the validation rules for each payload.
package models

import (
	"strings"
	"unicode/utf8"
)

// ValidationErrors maps a field name to a human readable problem.
type ValidationErrors map[string]string

// Add records a problem for a field, keeping the first message per field.
func (v ValidationErrors) Add(field, message string) {
	if _, exists := v[field]; !exists {
		v[field] = message
	}
}

// Any reports whether at least one field failed validation.
func (v ValidationErrors) Any() bool { return len(v) > 0 }

// UserSummary is the public projection of a user, safe to embed anywhere.
type UserSummary struct {
	ID    string  `json:"id"`
	Name  string  `json:"name"`
	Image *string `json:"image"`
	Role  string  `json:"role"`
}

// Trim normalises free text coming from a client.
func Trim(s string) string { return strings.TrimSpace(s) }

// TrimPtr normalises an optional string, collapsing empty values to nil.
func TrimPtr(s *string) *string {
	if s == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*s)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

// Length counts runes so multi-byte characters are not over-counted.
func Length(s string) int { return utf8.RuneCountInString(s) }

// Contains reports whether needle is present in haystack.
func Contains(haystack []string, needle string) bool {
	for _, item := range haystack {
		if item == needle {
			return true
		}
	}
	return false
}

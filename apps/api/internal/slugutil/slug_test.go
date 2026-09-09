package slugutil

import (
	"strings"
	"testing"
)

func TestBase(t *testing.T) {
	cases := map[string]string{
		"Linear Algebra Cheatsheet":  "linear-algebra-cheatsheet",
		"  Spaced   Out  ":           "spaced-out",
		"C++ & Go: a comparison":     "c-go-a-comparison",
		"---leading and trailing---": "leading-and-trailing",
		"":                           "",
		"!!!":                        "",
	}

	for input, want := range cases {
		if got := Base(input); got != want {
			t.Errorf("Base(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestBaseIsTruncatedAndTidy(t *testing.T) {
	got := Base(strings.Repeat("long title ", 20))

	if len(got) > 60 {
		t.Errorf("Base() length = %d, want at most 60", len(got))
	}
	if strings.HasSuffix(got, "-") || strings.HasPrefix(got, "-") {
		t.Errorf("Base() = %q, want no dangling separators", got)
	}
}

func TestMakeIsUniquePerCall(t *testing.T) {
	first := Make("Shared Title")
	second := Make("Shared Title")

	if first == second {
		t.Fatalf("two notes with the same title produced the same slug %q", first)
	}
	for _, slug := range []string{first, second} {
		if !strings.HasPrefix(slug, "shared-title-") {
			t.Errorf("Make() = %q, want the title as its prefix", slug)
		}
	}
}

func TestMakeHandlesUnusableTitles(t *testing.T) {
	slug := Make("!!!")
	if !strings.HasPrefix(slug, "note-") {
		t.Errorf("Make(%q) = %q, want a usable fallback slug", "!!!", slug)
	}
}

package repository

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"testing"
)

var placeholderPattern = regexp.MustCompile(`\$(\d+)`)

// assertPlaceholdersMatchArgs is the guard for the whole dynamic-SQL approach.
//
// Postgres derives a statement's parameter count from the highest $N it
// references, and rejects the bind if the client supplies a different number.
// A filter combination that leaves a gap - or that passes an argument the
// statement never mentions - therefore fails at runtime, not at compile time.
// Every generated statement is checked here instead.
func assertPlaceholdersMatchArgs(t *testing.T, name, query string, args []any) {
	t.Helper()

	used := map[int]bool{}
	highest := 0

	for _, match := range placeholderPattern.FindAllStringSubmatch(query, -1) {
		number, err := strconv.Atoi(match[1])
		if err != nil {
			t.Fatalf("%s: unparsable placeholder %q", name, match[0])
		}
		used[number] = true
		if number > highest {
			highest = number
		}
	}

	if highest != len(args) {
		t.Errorf("%s: highest placeholder is $%d but %d arguments are supplied\n%s",
			name, highest, len(args), query)
	}
	for number := 1; number <= highest; number++ {
		if !used[number] {
			t.Errorf("%s: $%d is never referenced, which leaves a gap in the parameter list\n%s",
				name, number, query)
		}
	}
}

// filterCases covers the scopes the service actually builds, including the
// admin listing, which applies no filters at all.
func filterCases() map[string]NoteFilter {
	return map[string]NoteFilter{
		"anonymous public listing": {
			ViewerID: "",
			Page:     1,
			PageSize: 12,
		},
		"signed-in public listing": {
			ViewerID: "user-1",
			Page:     2,
			PageSize: 12,
		},
		"search only": {
			ViewerID: "user-1",
			Search:   "fourier",
			Page:     1,
			PageSize: 12,
		},
		"tag and subject": {
			ViewerID: "user-1",
			Tag:      "calculus",
			Subject:  "Mathematics",
			Page:     1,
			PageSize: 12,
		},
		"author dashboard": {
			ViewerID:         "user-1",
			AuthorID:         "user-1",
			IncludeDrafts:    true,
			IncludeNonPublic: true,
			Page:             1,
			PageSize:         24,
		},
		"bookmarks": {
			ViewerID:     "user-1",
			BookmarkedBy: "user-1",
			Page:         1,
			PageSize:     24,
		},
		"admin listing with no filters": {
			ViewerID:         "admin-1",
			IncludeDrafts:    true,
			IncludeNonPublic: true,
			IncludeRemoved:   true,
			Page:             1,
			PageSize:         20,
		},
		"admin listing filtered": {
			ViewerID:         "admin-1",
			Search:           "spam",
			Status:           "removed",
			Visibility:       "private",
			IncludeDrafts:    true,
			IncludeNonPublic: true,
			IncludeRemoved:   true,
			Page:             3,
			PageSize:         20,
		},
		"every filter at once": {
			ViewerID:         "user-1",
			Search:           "linear algebra",
			Tag:              "Math",
			Subject:          "Mathematics",
			AuthorID:         "user-2",
			BookmarkedBy:     "user-1",
			Status:           "published",
			Visibility:       "public",
			Sort:             "popular",
			IncludeDrafts:    true,
			IncludeNonPublic: true,
			Page:             1,
			PageSize:         12,
		},
	}
}

func TestCountQueryPlaceholders(t *testing.T) {
	for name, filter := range filterCases() {
		t.Run(name, func(t *testing.T) {
			query, args := filter.countQuery()
			assertPlaceholdersMatchArgs(t, "count", query, args)

			// The count must never carry the projection; that is what made the
			// viewer id an unreferenced parameter in the first place. These two
			// markers appear only in the projection - a bookmarks subquery on
			// its own is legitimate, because filtering by BookmarkedBy uses one.
			for _, projectionOnly := range []string{"json_object_agg", "array_agg(r.type"} {
				if strings.Contains(query, projectionOnly) {
					t.Errorf("count query should not include the %q projection", projectionOnly)
				}
			}
		})
	}
}

func TestListQueryPlaceholders(t *testing.T) {
	for name, filter := range filterCases() {
		t.Run(name, func(t *testing.T) {
			query, args := filter.listQuery()
			assertPlaceholdersMatchArgs(t, "list", query, args)
		})
	}
}

// The viewer id, page size and offset are always the last three arguments, in
// that order, and the projection must read the viewer id from the right slot.
func TestListQueryBindsViewerAfterFilters(t *testing.T) {
	filter := NoteFilter{
		ViewerID: "user-42",
		Search:   "fourier",
		Tag:      "math",
		Page:     3,
		PageSize: 10,
	}

	query, args := filter.listQuery()

	if len(args) < 3 {
		t.Fatalf("expected at least 3 arguments, got %d", len(args))
	}
	viewerIndex := len(args) - 3

	if args[viewerIndex] != "user-42" {
		t.Errorf("viewer id is at the wrong position: got %v", args[viewerIndex])
	}
	if args[len(args)-2] != 10 {
		t.Errorf("page size = %v, want 10", args[len(args)-2])
	}
	if args[len(args)-1] != 20 {
		t.Errorf("offset = %v, want 20 for page 3 of 10", args[len(args)-1])
	}

	viewerPlaceholder := fmt.Sprintf("$%d", viewerIndex+1)
	if !strings.Contains(query, "r.user_id = "+viewerPlaceholder) {
		t.Errorf("projection does not read the viewer id from %s\n%s", viewerPlaceholder, query)
	}
}

// Scope flags decide what a listing may reveal; getting these wrong would leak
// drafts, private notes or moderated notes into a public listing.
func TestConditionsEnforceVisibilityScope(t *testing.T) {
	publicWhere, _ := NoteFilter{}.conditions()

	for _, required := range []string{
		"n.status <> 'removed'",
		"n.status = 'published'",
		"n.visibility = 'public'",
	} {
		if !strings.Contains(publicWhere, required) {
			t.Errorf("public listing is missing the guard %q\n%s", required, publicWhere)
		}
	}

	adminWhere, adminArgs := NoteFilter{
		IncludeDrafts:    true,
		IncludeNonPublic: true,
		IncludeRemoved:   true,
	}.conditions()

	if adminWhere != "" {
		t.Errorf("an unfiltered admin listing should have no WHERE clause, got %q", adminWhere)
	}
	if len(adminArgs) != 0 {
		t.Errorf("an unfiltered admin listing should take no arguments, got %d", len(adminArgs))
	}
}

func TestConditionsLowercasesTagFilter(t *testing.T) {
	_, args := NoteFilter{Tag: "Linear-Algebra"}.conditions()

	if len(args) != 1 {
		t.Fatalf("expected one argument, got %d", len(args))
	}
	if args[0] != "linear-algebra" {
		t.Errorf("tag filter = %v, want it lowercased to match stored tags", args[0])
	}
}

func TestOrderByFallsBackToNewestFirst(t *testing.T) {
	if got := (NoteFilter{Sort: "nonsense"}).orderBy(); got != "ORDER BY n.created_at DESC" {
		t.Errorf("unknown sort = %q, want the newest-first default", got)
	}
	if got := (NoteFilter{Sort: "views"}).orderBy(); !strings.Contains(got, "n.view_count DESC") {
		t.Errorf("views sort = %q", got)
	}
}

package models

import "testing"

func TestNoteRequestValidateDefaultsAndTrims(t *testing.T) {
	summary := "  a helpful summary  "
	req := NoteRequest{
		Title:   "  Linear Algebra Cheatsheet  ",
		Content: "  matrices and vectors  ",
		Summary: &summary,
		Tags:    []string{"Math", " math ", "#linear algebra", ""},
	}

	if errs := req.Validate(); errs.Any() {
		t.Fatalf("expected a valid note, got %v", errs)
	}
	if req.Title != "Linear Algebra Cheatsheet" {
		t.Errorf("title = %q, want the trimmed value", req.Title)
	}
	if *req.Summary != "a helpful summary" {
		t.Errorf("summary = %q, want the trimmed value", *req.Summary)
	}
	if req.Visibility != VisibilityPublic || req.Status != StatusPublished {
		t.Errorf("defaults = %s/%s, want public/published", req.Visibility, req.Status)
	}

	// "Math", " math " and "#linear algebra" collapse to two clean tags.
	want := []string{"math", "linear-algebra"}
	if len(req.Tags) != len(want) {
		t.Fatalf("tags = %v, want %v", req.Tags, want)
	}
	for i, tag := range want {
		if req.Tags[i] != tag {
			t.Errorf("tags[%d] = %q, want %q", i, req.Tags[i], tag)
		}
	}
}

func TestNoteRequestValidateRejectsBadInput(t *testing.T) {
	cases := map[string]struct {
		req   NoteRequest
		field string
	}{
		"empty title":                          {NoteRequest{Content: "body"}, "title"},
		"short title":                          {NoteRequest{Title: "ab", Content: "body"}, "title"},
		"empty content":                        {NoteRequest{Title: "A good title"}, "content"},
		"bad visibility":                       {NoteRequest{Title: "A good title", Content: "body", Visibility: "secret"}, "visibility"},
		"bad status":                           {NoteRequest{Title: "A good title", Content: "body", Status: "archived"}, "status"},
		"removed is not settable by an author": {NoteRequest{Title: "A good title", Content: "body", Status: StatusRemoved}, "status"},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			errs := tc.req.Validate()
			if !errs.Any() {
				t.Fatal("expected validation to fail")
			}
			if _, reported := errs[tc.field]; !reported {
				t.Errorf("errors = %v, want a problem on %q", errs, tc.field)
			}
		})
	}
}

func TestNoteRequestRejectsIncompleteUpload(t *testing.T) {
	req := NoteRequest{
		Title:       "Uploaded lecture notes",
		Content:     "see the attached pdf",
		Attachments: []AttachmentInput{{URL: "https://example.com/a.pdf"}},
	}

	errs := req.Validate()
	if _, reported := errs["attachments"]; !reported {
		t.Errorf("errors = %v, want an attachments problem for a missing publicId", errs)
	}
}

func TestReactionRequestValidate(t *testing.T) {
	for _, reaction := range ReactionTypes {
		req := ReactionRequest{Type: reaction}
		if errs := req.Validate(); errs.Any() {
			t.Errorf("%q should be a valid reaction, got %v", reaction, errs)
		}
	}

	req := ReactionRequest{Type: "thumbsdown"}
	if errs := req.Validate(); !errs.Any() {
		t.Error("an unknown reaction type should be rejected")
	}
}

func TestCommentRequestValidate(t *testing.T) {
	req := CommentRequest{Content: "   "}
	if errs := req.Validate(); !errs.Any() {
		t.Error("a blank comment should be rejected")
	}

	long := CommentRequest{Content: string(make([]byte, MaxCommentLength+1))}
	if errs := long.Validate(); !errs.Any() {
		t.Error("an over-long comment should be rejected")
	}
}

func TestUserStatusRequestGuardsRoles(t *testing.T) {
	role := "superuser"
	req := UserStatusRequest{Role: &role}
	if errs := req.Validate(); !errs.Any() {
		t.Error("an unknown role should be rejected")
	}

	empty := UserStatusRequest{}
	if errs := empty.Validate(); !errs.Any() {
		t.Error("an empty update should be rejected")
	}
}

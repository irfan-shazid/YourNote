package models

// The reaction palette. "like" is surfaced as the primary like button in the
// UI; the rest render as the emoji reaction bar.
const (
	ReactionLike       = "like"
	ReactionLove       = "love"
	ReactionFire       = "fire"
	ReactionInsightful = "insightful"
	ReactionClap       = "clap"
	ReactionWow        = "wow"
)

// ReactionTypes is the allow-list of reaction values, in display order.
var ReactionTypes = []string{
	ReactionLike,
	ReactionLove,
	ReactionFire,
	ReactionInsightful,
	ReactionClap,
	ReactionWow,
}

// IsValidReaction reports whether t is a supported reaction type.
func IsValidReaction(t string) bool { return Contains(ReactionTypes, t) }

// ReactionRequest toggles one reaction type on a note.
type ReactionRequest struct {
	Type string `json:"type"`
}

// Validate checks the requested reaction type.
func (r *ReactionRequest) Validate() ValidationErrors {
	errs := ValidationErrors{}
	r.Type = Trim(r.Type)
	if r.Type == "" {
		errs.Add("type", "Pick a reaction.")
	} else if !IsValidReaction(r.Type) {
		errs.Add("type", "That reaction is not supported.")
	}
	return errs
}

// ReactionResult is returned after a toggle so the UI can update in place.
type ReactionResult struct {
	Reacted        bool           `json:"reacted"`
	Type           string         `json:"type"`
	Total          int            `json:"total"`
	ReactionCounts map[string]int `json:"reactionCounts"`
	Viewer         []string       `json:"viewerReactions"`
}

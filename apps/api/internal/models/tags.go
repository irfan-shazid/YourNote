package models

import (
	"sort"
	"strings"
)

// NormaliseTags lowercases, de-duplicates and strips noise from user supplied
// tags so "React", "  react " and "react" all collapse to a single value.
func NormaliseTags(raw []string) []string {
	seen := make(map[string]struct{}, len(raw))
	out := make([]string, 0, len(raw))

	for _, tag := range raw {
		clean := strings.ToLower(strings.TrimSpace(tag))
		clean = strings.Trim(clean, "#")
		clean = strings.Join(strings.Fields(clean), "-")
		if clean == "" {
			continue
		}
		if _, exists := seen[clean]; exists {
			continue
		}
		seen[clean] = struct{}{}
		out = append(out, clean)
	}
	return out
}

// TagCount is one row of the popular-tags endpoint.
type TagCount struct {
	Tag   string `json:"tag"`
	Count int    `json:"count"`
}

// SortTagCounts orders tags by frequency, then alphabetically for stability.
func SortTagCounts(counts []TagCount) {
	sort.SliceStable(counts, func(i, j int) bool {
		if counts[i].Count != counts[j].Count {
			return counts[i].Count > counts[j].Count
		}
		return counts[i].Tag < counts[j].Tag
	})
}

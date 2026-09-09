// Package httpx contains small helpers shared by every HTTP handler:
// JSON encoding, typed API errors and query-string parsing.
package httpx

import (
	"encoding/json"
	"log"
	"net/http"
)

// Envelope is the shape every successful response uses.
type Envelope struct {
	Data any             `json:"data"`
	Meta *PaginationMeta `json:"meta,omitempty"`
}

// PaginationMeta describes a page of a list endpoint.
type PaginationMeta struct {
	Page       int  `json:"page"`
	PageSize   int  `json:"pageSize"`
	Total      int  `json:"total"`
	TotalPages int  `json:"totalPages"`
	HasMore    bool `json:"hasMore"`
}

// JSON writes v as a JSON body with the given status code.
func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if v == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("httpx: encode response: %v", err)
	}
}

// OK writes a 200 with the standard envelope.
func OK(w http.ResponseWriter, data any) {
	JSON(w, http.StatusOK, Envelope{Data: data})
}

// Created writes a 201 with the standard envelope.
func Created(w http.ResponseWriter, data any) {
	JSON(w, http.StatusCreated, Envelope{Data: data})
}

// List writes a 200 with pagination metadata attached.
func List(w http.ResponseWriter, data any, meta PaginationMeta) {
	JSON(w, http.StatusOK, Envelope{Data: data, Meta: &meta})
}

// NoContent writes an empty 204.
func NoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}

// NewPaginationMeta derives page metadata from a total row count.
func NewPaginationMeta(page, pageSize, total int) PaginationMeta {
	totalPages := 0
	if pageSize > 0 {
		totalPages = (total + pageSize - 1) / pageSize
	}
	return PaginationMeta{
		Page:       page,
		PageSize:   pageSize,
		Total:      total,
		TotalPages: totalPages,
		HasMore:    page < totalPages,
	}
}

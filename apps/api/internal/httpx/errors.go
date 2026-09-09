package httpx

import (
	"errors"
	"log"
	"net/http"
)

// APIError is an error that knows which HTTP status it should produce.
type APIError struct {
	Status  int    `json:"-"`
	Code    string `json:"code"`
	Message string `json:"message"`
	// Fields carries per-field validation messages, keyed by field name.
	Fields map[string]string `json:"fields,omitempty"`
	// wrapped keeps the underlying cause for server-side logging only.
	wrapped error
}

func (e *APIError) Error() string { return e.Message }

func (e *APIError) Unwrap() error { return e.wrapped }

// WithCause attaches an internal cause that is logged but never sent to clients.
func (e *APIError) WithCause(err error) *APIError {
	clone := *e
	clone.wrapped = err
	return &clone
}

func newError(status int, code, message string) *APIError {
	return &APIError{Status: status, Code: code, Message: message}
}

// Constructors for the errors the API actually returns.
func BadRequest(message string) *APIError {
	return newError(http.StatusBadRequest, "bad_request", message)
}
func Unauthorized(message string) *APIError {
	return newError(http.StatusUnauthorized, "unauthorized", message)
}
func Forbidden(message string) *APIError { return newError(http.StatusForbidden, "forbidden", message) }
func NotFound(message string) *APIError  { return newError(http.StatusNotFound, "not_found", message) }
func Conflict(message string) *APIError  { return newError(http.StatusConflict, "conflict", message) }
func TooManyRequests(message string) *APIError {
	return newError(http.StatusTooManyRequests, "rate_limited", message)
}
func Internal(err error) *APIError {
	return newError(http.StatusInternalServerError, "internal_error", "Something went wrong on our side.").WithCause(err)
}

// Invalid builds a 422 carrying per-field validation messages.
func Invalid(fields map[string]string) *APIError {
	e := newError(http.StatusUnprocessableEntity, "validation_failed", "Please check the highlighted fields.")
	e.Fields = fields
	return e
}

// errorBody is the wire format for a failed request.
type errorBody struct {
	Error *APIError `json:"error"`
}

// Error writes err as a JSON error response. Anything that is not an *APIError
// is treated as an unexpected failure and reported as a generic 500.
func Error(w http.ResponseWriter, r *http.Request, err error) {
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		apiErr = Internal(err)
	}
	if apiErr.Status >= http.StatusInternalServerError {
		cause := apiErr.wrapped
		if cause == nil {
			cause = err
		}
		log.Printf("api: %s %s -> %d: %v", r.Method, r.URL.Path, apiErr.Status, cause)
	}
	JSON(w, apiErr.Status, errorBody{Error: apiErr})
}

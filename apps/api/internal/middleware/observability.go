package middleware

import (
	"log"
	"net/http"
	"time"

	"github.com/yournote/api/internal/httpx"
)

// statusRecorder remembers the status code so the logger can report it.
type statusRecorder struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

func (s *statusRecorder) Write(b []byte) (int, error) {
	if s.status == 0 {
		s.status = http.StatusOK
	}
	n, err := s.ResponseWriter.Write(b)
	s.bytes += n
	return n, err
}

// Logger writes one line per request: method, path, status, size and duration.
func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		recorder := &statusRecorder{ResponseWriter: w}

		next.ServeHTTP(recorder, r)

		if recorder.status == 0 {
			recorder.status = http.StatusOK
		}
		log.Printf("%s %s %d %dB %s",
			r.Method, r.URL.RequestURI(), recorder.status, recorder.bytes,
			time.Since(started).Round(time.Millisecond))
	})
}

// Recoverer turns a panic into a 500 instead of a dropped connection, and logs
// the failure so it is never silently swallowed.
func Recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				log.Printf("panic: %v", recovered)
				httpx.JSON(w, http.StatusInternalServerError, map[string]any{
					"error": map[string]string{
						"code":    "internal_error",
						"message": "Something went wrong on our side.",
					},
				})
			}
		}()
		next.ServeHTTP(w, r)
	})
}

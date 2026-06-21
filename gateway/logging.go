package main

import (
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

// RequestLogger logs one logfmt line per request and echoes the correlation id
// (set by chi's RequestID middleware, reused from an inbound X-Request-Id header
// or freshly generated) back as a response header so callers and downstream
// services share the same id. See OBSERVABILITY.md for the log schema.
func RequestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rid := middleware.GetReqID(r.Context())
		w.Header().Set("X-Request-Id", rid)

		// Wrap response writer to capture status code
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

		next.ServeHTTP(ww, r)

		log.Printf(
			"ts=%s level=info service=gateway request_id=%s method=%s path=%s status=%d duration_ms=%.1f remote_addr=%s",
			time.Now().UTC().Format(time.RFC3339Nano),
			rid,
			r.Method,
			r.URL.Path,
			ww.Status(),
			time.Since(start).Seconds()*1000,
			r.RemoteAddr,
		)
	})
}

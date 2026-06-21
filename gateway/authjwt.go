package main

import (
	"bytes"
	"context"
	"crypto/subtle"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"
)

// access level required to reach a route.
type accessLevel int

const (
	accessPublic accessLevel = iota
	accessGuest
	accessAdmin
)

type ctxKey string

const identityCtxKey ctxKey = "gw_identity"

// identityFrom returns the verified identity attached by JWTEnforce, if any.
func identityFrom(r *http.Request) *Claims {
	if v, ok := r.Context().Value(identityCtxKey).(*Claims); ok {
		return v
	}
	return nil
}

// requiredAccess maps a request to the access level the gateway enforces.
//
// Public  — no token (health, aggregate stats, the auth endpoints themselves,
//
//	and the broadcast SSE stream which authenticates with its own service
//	token because EventSource cannot send an Authorization header).
//
// Admin   — any admin-scoped path: the gateway's own /admin/* and any proxied
//
//	service admin route (e.g. /api/parrot/admin/*).
//
// Guest   — every other /api/* route and /auth/me.
func requiredAccess(method, path string) accessLevel {
	// CORS preflight is always allowed.
	if method == http.MethodOptions {
		return accessPublic
	}

	switch {
	case path == "/health":
		return accessPublic
	case path == "/auth/guest", path == "/auth/admin":
		return accessPublic
	// Aggregate, non-personal airport stats are public.
	case method == http.MethodGet && path == "/api/airport/stats":
		return accessPublic
	// SSE event stream carries its own ?token= service credential; EventSource
	// cannot attach a bearer token, so the JWT layer must not gate it.
	case strings.HasPrefix(path, "/api/broadcast"):
		return accessPublic
	}

	// Admin-scoped routes: the gateway's own admin endpoints and any proxied
	// service admin path.
	if strings.HasPrefix(path, "/admin/") || strings.Contains(path, "/admin/") {
		return accessAdmin
	}

	if path == "/auth/me" || strings.HasPrefix(path, "/api/") {
		return accessGuest
	}

	return accessPublic
}

func bearerToken(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if h == "" {
		return ""
	}
	const prefix = "Bearer "
	if len(h) > len(prefix) && strings.EqualFold(h[:len(prefix)], prefix) {
		return strings.TrimSpace(h[len(prefix):])
	}
	return ""
}

// guestIDFromRequest extracts the guest identity a request acts upon, from the
// path (…/by-guest/{id}, …/history/{id}, /api/airport/arrivals/{id}) or the JSON
// body (guest_id, or beach's visitor "id"). bodyBytes may be nil for GETs.
func guestIDFromRequest(path string, bodyBytes []byte) string {
	segs := strings.Split(strings.Trim(path, "/"), "/")

	for i := 0; i+1 < len(segs); i++ {
		if segs[i] == "by-guest" || segs[i] == "history" {
			return segs[i+1]
		}
	}
	// GET /api/airport/arrivals/{guest_id} (single lookup, not the list).
	if len(segs) == 4 && segs[0] == "api" && segs[1] == "airport" && segs[2] == "arrivals" {
		return segs[3]
	}

	if len(bodyBytes) == 0 {
		return ""
	}
	var m map[string]json.RawMessage
	if json.Unmarshal(bodyBytes, &m) != nil {
		return ""
	}
	if raw, ok := m["guest_id"]; ok {
		var s string
		if json.Unmarshal(raw, &s) == nil && s != "" {
			return s
		}
	}
	// Beach book/cancel identify the visitor with "id".
	if strings.Contains(path, "/beach/activity/book/") || strings.Contains(path, "/beach/activity/cancel/") {
		if raw, ok := m["id"]; ok {
			var s string
			if json.Unmarshal(raw, &s) == nil {
				return s
			}
		}
	}
	return ""
}

func writeAuthError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	w.Write([]byte(`{"error": "` + msg + `"}`))
}

// JWTEnforce verifies bearer tokens and enforces the route access model:
//   - missing/invalid/expired token on a protected route -> 401
//   - guest token on an admin route -> 403
//   - guest token acting on another guest's guest_id -> 403
//   - admin token may act on any guest_id
func JWTEnforce(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			level := requiredAccess(r.Method, r.URL.Path)
			if level == accessPublic {
				next.ServeHTTP(w, r)
				return
			}

			token := bearerToken(r)
			if token == "" {
				writeAuthError(w, http.StatusUnauthorized, "Authentication required")
				return
			}
			claims, err := ParseToken(token, secret)
			if err != nil {
				writeAuthError(w, http.StatusUnauthorized, "Invalid or expired token")
				return
			}

			if level == accessAdmin && claims.Role != "admin" {
				writeAuthError(w, http.StatusForbidden, "Admin access required")
				return
			}

			// Guest tokens may only act on their own guest_id. Admin tokens act
			// on behalf of any guest, so they skip this check.
			if claims.Role == "guest" {
				var body []byte
				if r.Body != nil && (r.Method == http.MethodPost || r.Method == http.MethodPut || r.Method == http.MethodPatch || r.Method == http.MethodDelete) {
					body, _ = io.ReadAll(r.Body)
					r.Body = io.NopCloser(bytes.NewReader(body)) // restore for the proxy
				}
				if target := guestIDFromRequest(r.URL.Path, body); target != "" && target != claims.GuestID {
					writeAuthError(w, http.StatusForbidden, "Token identity does not match requested guest")
					return
				}
			}

			ctx := context.WithValue(r.Context(), identityCtxKey, &claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// AuthGuestHandler issues a guest token. Login is identity selection: the
// frontend supplies a guest_id from its list and the JWT fixes it for the
// session.
func AuthGuestHandler(secret string, ttl time.Duration) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			GuestID string `json:"guest_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.GuestID) == "" {
			writeAuthError(w, http.StatusBadRequest, "guest_id is required")
			return
		}
		token, err := SignToken("guest", body.GuestID, secret, ttl)
		if err != nil {
			writeAuthError(w, http.StatusInternalServerError, "could not issue token")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"token": token})
	}
}

// AuthAdminHandler validates the passcode against ADMIN_PASSCODE and issues an
// admin token. Fails closed when no passcode is configured.
func AuthAdminHandler(secret, adminPasscode string, ttl time.Duration) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Passcode string `json:"passcode"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeAuthError(w, http.StatusBadRequest, "passcode is required")
			return
		}
		if adminPasscode == "" || subtle.ConstantTimeCompare([]byte(body.Passcode), []byte(adminPasscode)) != 1 {
			writeAuthError(w, http.StatusUnauthorized, "Invalid passcode")
			return
		}
		token, err := SignToken("admin", "", secret, ttl)
		if err != nil {
			writeAuthError(w, http.StatusInternalServerError, "could not issue token")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"token": token})
	}
}

// AuthMeHandler returns the verified session identity. JWTEnforce has already
// validated the token (this route is guest-level) and attached the claims.
func AuthMeHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := identityFrom(r)
		if id == nil {
			writeAuthError(w, http.StatusUnauthorized, "Authentication required")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		if id.Role == "admin" {
			json.NewEncoder(w).Encode(map[string]string{"role": "admin"})
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"role": "guest", "guest_id": id.GuestID})
	}
}

package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// blockingBackend is a test handler that counts how many times it is invoked and
// holds each invocation open until release is closed — so we can fire many
// concurrent requests and observe how many actually reach the backend.
type blockingBackend struct {
	hits    int64
	release chan struct{}
	body    func(path string) string
}

func (b *blockingBackend) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	atomic.AddInt64(&b.hits, 1)
	if b.release != nil {
		<-b.release
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	body := `{"ok":true}`
	if b.body != nil {
		body = b.body(r.URL.Path)
	}
	w.Write([]byte(body))
}

// TestCoalescesConcurrentSameURL is the core card requirement: many concurrent
// requests for the same uncached URL must result in exactly ONE backend fetch,
// and every request must still receive the correct body.
func TestCoalescesConcurrentSameURL(t *testing.T) {
	backend := &blockingBackend{release: make(chan struct{})}
	h := CacheMiddleware(time.Minute)(backend)

	const n = 50
	var wg sync.WaitGroup
	recs := make([]*httptest.ResponseRecorder, n)
	for i := 0; i < n; i++ {
		wg.Add(1)
		recs[i] = httptest.NewRecorder()
		go func(idx int) {
			defer wg.Done()
			req := httptest.NewRequest(http.MethodGet, "/api/hotel/rooms", nil)
			h.ServeHTTP(recs[idx], req)
		}(i)
	}

	// Give all goroutines time to arrive and coalesce onto one flight before the
	// single backend call is allowed to complete.
	time.Sleep(100 * time.Millisecond)
	close(backend.release)
	wg.Wait()

	if got := atomic.LoadInt64(&backend.hits); got != 1 {
		t.Fatalf("expected exactly 1 backend hit for concurrent same-URL requests, got %d", got)
	}
	for i, rec := range recs {
		if rec.Code != http.StatusOK {
			t.Errorf("request %d: status = %d, want 200", i, rec.Code)
		}
		if rec.Body.String() != `{"ok":true}` {
			t.Errorf("request %d: body = %q, want shared backend body", i, rec.Body.String())
		}
	}
}

// TestDifferentURLsRunInParallel asserts the other half of the card: requests
// for DIFFERENT URLs must never block one another. We block all backends, fire
// one request per distinct URL, and require that all of them reach the backend
// concurrently (none is serialized behind another key's flight).
func TestDifferentURLsRunInParallel(t *testing.T) {
	const n = 10
	arrived := make(chan struct{}, n)
	release := make(chan struct{})
	var hits int64

	backend := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt64(&hits, 1)
		arrived <- struct{}{}
		<-release // hold open so we can prove concurrency
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(r.URL.Path))
	})
	h := CacheMiddleware(time.Minute)(backend)

	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/svc/%d", idx), nil)
			h.ServeHTTP(rec, req)
		}(i)
	}

	// All n distinct-URL requests must reach the backend without any being
	// blocked; if coalescing wrongly serialized different keys, fewer than n
	// would arrive and this would time out.
	deadline := time.After(2 * time.Second)
	for i := 0; i < n; i++ {
		select {
		case <-arrived:
		case <-deadline:
			t.Fatalf("only %d/%d distinct-URL requests reached the backend; different URLs are blocking each other", i, n)
		}
	}
	close(release)
	wg.Wait()

	if got := atomic.LoadInt64(&hits); got != n {
		t.Fatalf("expected %d backend hits (one per distinct URL), got %d", n, got)
	}
}

// TestCachedAfterCoalesce verifies that once a coalesced fetch completes, the
// result is cached: a subsequent request is a HIT and does not hit the backend.
func TestCachedAfterCoalesce(t *testing.T) {
	backend := &blockingBackend{}
	h := CacheMiddleware(time.Minute)(backend)

	rec1 := httptest.NewRecorder()
	h.ServeHTTP(rec1, httptest.NewRequest(http.MethodGet, "/api/hotel/rooms", nil))
	if rec1.Header().Get("X-Cache") == "HIT" {
		t.Errorf("first request should be a MISS, got X-Cache=HIT")
	}

	rec2 := httptest.NewRecorder()
	h.ServeHTTP(rec2, httptest.NewRequest(http.MethodGet, "/api/hotel/rooms", nil))
	if rec2.Header().Get("X-Cache") != "HIT" {
		t.Errorf("second request should be a HIT, got X-Cache=%q", rec2.Header().Get("X-Cache"))
	}
	if got := atomic.LoadInt64(&backend.hits); got != 1 {
		t.Fatalf("expected 1 backend hit (second served from cache), got %d", got)
	}
}

// TestLeaderPanicDoesNotStrandFollowers verifies that if the leader's backend
// call panics, waiting followers are still released (and fall back to their own
// fetch) rather than blocking forever on the flight.
func TestLeaderPanicDoesNotStrandFollowers(t *testing.T) {
	var calls int64
	gate := make(chan struct{})
	backend := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := atomic.AddInt64(&calls, 1)
		if n == 1 {
			<-gate       // hold the leader open so a follower coalesces behind it
			panic("boom") // leader fails mid-flight
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ok":true}`))
	})
	h := CacheMiddleware(time.Minute)(backend)

	// Recoverer stand-in: swallow the leader's panic like chi's middleware would.
	safe := func(rec *httptest.ResponseRecorder, req *http.Request) {
		defer func() { _ = recover() }()
		h.ServeHTTP(rec, req)
	}

	var wg sync.WaitGroup
	wg.Add(2)
	go func() { defer wg.Done(); safe(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/api/x", nil)) }()
	time.Sleep(50 * time.Millisecond) // let the follower arrive and coalesce
	followerDone := make(chan struct{})
	go func() {
		defer wg.Done()
		safe(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/api/x", nil))
		close(followerDone)
	}()

	close(gate) // release the leader -> it panics

	select {
	case <-followerDone:
	case <-time.After(2 * time.Second):
		t.Fatal("follower was stranded after the leader panicked")
	}
	wg.Wait()
}

// TestDistinctQueryStringsNotCoalesced ensures coalescing keys on the full
// cache key (path + query), so two genuinely different requests are not merged.
func TestDistinctQueryStringsNotCoalesced(t *testing.T) {
	backend := &blockingBackend{
		release: make(chan struct{}),
		body:    func(path string) string { return `{"ok":true}` },
	}
	h := CacheMiddleware(time.Minute)(backend)

	var wg sync.WaitGroup
	for _, q := range []string{"a=1", "a=2"} {
		wg.Add(1)
		go func(query string) {
			defer wg.Done()
			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/api/svc?"+query, nil)
			h.ServeHTTP(rec, req)
		}(q)
	}
	time.Sleep(100 * time.Millisecond)
	close(backend.release)
	wg.Wait()

	if got := atomic.LoadInt64(&backend.hits); got != 2 {
		t.Fatalf("expected 2 backend hits for two distinct query strings, got %d", got)
	}
}

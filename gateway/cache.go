package main

import (
	"bytes"
	"net/http"
	"strings"
	"sync"
	"time"
)

type cacheEntry struct {
	status  int
	header  http.Header
	body    []byte
	expires time.Time
}

type responseCache struct {
	mu      sync.Mutex
	entries map[string]cacheEntry
	ttl     time.Duration

	// flights tracks in-progress backend fetches for request coalescing
	// (single-flight). The first request for an uncached key creates a flight
	// and performs the fetch; concurrent requests for the SAME key wait on it
	// and share the result, so the backend is hit once rather than once per
	// request. Keyed by cache key, so different URLs never block one another.
	flightsMu sync.Mutex
	flights   map[string]*flight
}

// flight is one in-progress backend fetch shared by all coalesced requests for
// a key. done is closed when the fetch completes; result then holds the captured
// response to replay to every waiter.
type flight struct {
	done   chan struct{}
	result flightResult
}

// flightResult is the captured response of a coalesced fetch. cacheable mirrors
// cacheCapture: when false (e.g. an error or SSE response) waiters fall back to
// fetching themselves rather than sharing an unreplayable response.
type flightResult struct {
	status    int
	header    http.Header
	body      []byte
	cacheable bool
}

func newResponseCache(ttl time.Duration) *responseCache {
	return &responseCache{
		entries: make(map[string]cacheEntry),
		ttl:     ttl,
		flights: make(map[string]*flight),
	}
}

// beginFlight returns the in-flight fetch for key. The returned bool is true for
// the leader (the caller that must perform the fetch and then call finishFlight);
// it is false for followers, which must wait on fl.done and replay fl.result.
func (c *responseCache) beginFlight(key string) (fl *flight, leader bool) {
	c.flightsMu.Lock()
	defer c.flightsMu.Unlock()
	if existing, ok := c.flights[key]; ok {
		return existing, false
	}
	fl = &flight{done: make(chan struct{})}
	c.flights[key] = fl
	return fl, true
}

// finishFlight publishes the leader's result to any waiters and removes the
// flight so the next request for this key (after it may have expired) starts
// fresh. Always called by the leader, even on a non-cacheable response.
func (c *responseCache) finishFlight(key string, fl *flight, result flightResult) {
	fl.result = result
	c.flightsMu.Lock()
	delete(c.flights, key)
	c.flightsMu.Unlock()
	close(fl.done)
}

func (c *responseCache) get(key string) (cacheEntry, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.entries[key]
	if !ok {
		return cacheEntry{}, false
	}
	if time.Now().After(e.expires) {
		delete(c.entries, key)
		return cacheEntry{}, false
	}
	return e, true
}

func (c *responseCache) set(key string, e cacheEntry) {
	e.expires = time.Now().Add(c.ttl)
	c.mu.Lock()
	c.entries[key] = e
	c.mu.Unlock()
}

// writeReplay writes a previously captured response (a cache hit or a coalesced
// follower's shared result) to w, tagging it with the given X-Cache value.
func writeReplay(w http.ResponseWriter, header http.Header, status int, body []byte, cacheTag string) {
	for k, vals := range header {
		for _, v := range vals {
			w.Header().Add(k, v)
		}
	}
	w.Header().Set("X-Cache", cacheTag)
	w.WriteHeader(status)
	w.Write(body)
}

// cacheCapture tees a cacheable response into a buffer while passing it through
// to the client. Cacheability is decided on the first WriteHeader (200 +
// non-streaming Content-Type), so SSE responses are never buffered and flushes
// pass straight through — keeping the proxy's FlushInterval = -1 behaviour.
type cacheCapture struct {
	http.ResponseWriter
	buf       bytes.Buffer
	status    int
	cacheable bool
	decided   bool
}

func (c *cacheCapture) WriteHeader(code int) {
	if !c.decided {
		c.status = code
		ct := c.Header().Get("Content-Type")
		c.cacheable = code == http.StatusOK && !strings.HasPrefix(ct, "text/event-stream")
		c.decided = true
	}
	c.ResponseWriter.WriteHeader(code)
}

func (c *cacheCapture) Write(b []byte) (int, error) {
	if !c.decided {
		c.WriteHeader(http.StatusOK)
	}
	if c.cacheable {
		c.buf.Write(b)
	}
	return c.ResponseWriter.Write(b)
}

func (c *cacheCapture) Flush() {
	if f, ok := c.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// CacheMiddleware caches safe responses (GET/HEAD, status 200, non-streaming)
// for ttl. No-op when ttl <= 0.
func CacheMiddleware(ttl time.Duration) func(http.Handler) http.Handler {
	if ttl <= 0 {
		return func(next http.Handler) http.Handler { return next }
	}
	cache := newResponseCache(ttl)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodGet && r.Method != http.MethodHead {
				next.ServeHTTP(w, r)
				return
			}

			// Key on method + path + canonicalized query so requests that
			// differ only by query string don't collide.
			key := r.Method + " " + r.URL.Path + "?" + r.URL.Query().Encode()

			if e, ok := cache.get(key); ok {
				writeReplay(w, e.header, e.status, e.body, "HIT")
				return
			}

			// Cache miss: coalesce concurrent requests for the same key so only
			// one reaches the backend. The leader fetches; followers wait and
			// replay its result. Different keys get different flights, so they
			// never block one another.
			fl, leader := cache.beginFlight(key)

			if !leader {
				<-fl.done
				res := fl.result
				if res.cacheable {
					// Re-check the cache first: by now the leader has stored a
					// fresh entry, which is the canonical source to serve from.
					if e, ok := cache.get(key); ok {
						writeReplay(w, e.header, e.status, e.body, "HIT")
						return
					}
					writeReplay(w, res.header, res.status, res.body, "HIT")
					return
				}
				// Leader's response wasn't replayable (error, SSE, etc.) — this
				// request fetches on its own rather than sharing nothing.
				cc := &cacheCapture{ResponseWriter: w}
				next.ServeHTTP(cc, r)
				return
			}

			// Leader path: perform the fetch, then publish the result to waiters.
			// finishFlight is deferred so that even if next.ServeHTTP panics, the
			// flight is always closed — followers are released (with a
			// non-cacheable result, so they fall back to fetching) rather than
			// blocking forever on fl.done. The panic still propagates to the
			// upstream Recoverer afterwards.
			var result flightResult
			defer func() { cache.finishFlight(key, fl, result) }()

			cc := &cacheCapture{ResponseWriter: w}
			next.ServeHTTP(cc, r)

			result = flightResult{
				status:    cc.status,
				header:    w.Header().Clone(),
				body:      cc.buf.Bytes(),
				cacheable: cc.cacheable,
			}
			if cc.cacheable {
				cache.set(key, cacheEntry{
					status: result.status,
					header: result.header,
					body:   result.body,
				})
			}
		})
	}
}

# Observability

Purrlington Island has no metrics/tracing backend (no Prometheus, no Jaeger/OTel
collector) — every service just logs to stdout, which Docker already captures via
`docker compose logs`. Standing up a collector for a hackathon stack would be a lot
of new infrastructure for the payoff, so instead every service follows the same
**log-based tracing** convention: structured (logfmt) access logs, correlated across
the whole system by a single id. This gives you most of what a tracing backend would
show — the full hop-by-hop path and per-hop latency of any one request — for the cost
of a few stdlib log lines per service.

## How it works

A correlation id travels in the `X-Request-Id` header. The gateway is the usual
origin point (the frontend doesn't send one today), but any service reuses an
inbound id instead of minting a new one, and every service-to-service call
(gateway → backend, parrot → airport/hotel/crab/broadcast, hotel → airport/broadcast,
beach → broadcast, crab → broadcast) forwards the same id. Every service echoes it
back as a response header too.

## Log schema

**Access log** — one line per inbound HTTP request:
```
ts=<ISO8601> level=info service=<name> request_id=<id> method=<m> path=<p> status=<code> duration_ms=<float>
```

**Outbound call log** — one line per call a service makes to another internal
service:
```
ts=<ISO8601> level=info service=<name> event=outbound_call request_id=<id> target=<svc> method=<m> path=<p> status=<code> duration_ms=<float>
```

Both are plain `key=value` (logfmt) text, so they're greppable without any log
shipper or JSON parser, and survive being mixed in with each framework's own log
prefix (Nest's `Logger`, logback, Python's `logging`, etc. all add their own
timestamp/level prefix in front — that's expected, just ignore it and grep for the
fields above).

## Worked example: finding the slow hop

A guest creates a hotel reservation. The gateway proxies it to hotel; hotel calls
airport to check the guest cleared passport control before persisting the
reservation. To see where the time went:

```bash
docker compose logs gateway hotel airport | grep "request_id=<id-from-response-header>"
```

Expected line sequence:
```
gateway: request_id=abc123 method=POST path=/api/hotel/reservation status=201 duration_ms=420.0
hotel:   request_id=abc123 method=POST path=/reservation status=201 duration_ms=410.0
hotel:   request_id=abc123 event=outbound_call target=airport method=GET path=/arrivals/g1 status=200 duration_ms=380.0
airport: request_id=abc123 method=GET path=/arrivals/g1 status=200 duration_ms=2.0
```

Reading top to bottom: the gateway hop adds ~10ms of its own; nearly all of hotel's
410ms is the 380ms spent waiting on its outbound call to airport; but airport itself
only took 2ms to answer — so the actual time is in the network/connection hop between
hotel and airport, not in either service's own processing. That's the kind of thing
this is for: a `duration_ms` that's large at the calling layer but small at the
called layer points at the hop between them, not at either service's logic.

## `request_id=-` is expected, not a bug

A few call sites have no inbound HTTP request to inherit an id from, so they log
`request_id=-` by design:

| Service | Where | Why |
|---|---|---|
| airport | `gate_manager.py`'s background gate-processing threads, and the `broadcast.py` events they fire | Passport processing runs on a simulated clock in background threads, not inside a request |
| beach | `HotelCheckInBroadcastClient`'s SSE listener thread | Background listener consuming hotel check-in events, not serving a request |
| gateway | `/health`'s per-backend probes | Periodic infra polling, not a guest-facing traced request |

## Caveats

- **Broadcast's `/events` is a long-lived SSE stream.** Its access line only logs
  when the client disconnects (`res.on('finish')`), so `duration_ms` there is the
  connection's lifetime, not request latency — don't mistake a multi-hour value for
  a hang.
- **`/health` endpoints are high-frequency and low-signal.** When grepping for
  bottlenecks, `grep -v path=/health` cuts the noise.

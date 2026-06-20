# Purrlington Island — Bug Report

> Generated: 2026-06-20
> Scope: Full-stack analysis of all 7 components

---

## Table of Contents

- [Infrastructure](#infrastructure)
- [Gateway (Go)](#gateway-go)
- [Airport (Python / Flask)](#airport-python--flask)
- [Hotel (NestJS / Prisma)](#hotel-nestjs--prisma)
- [Broadcast (Node / Express SSE)](#broadcast-node--express-sse)
- [Beach (Kotlin / Ktor)](#beach-kotlin--ktor)
- [Frontend (React / Vite)](#frontend-react--vite)
- [Parrot (Python / FastAPI)](#parrot-python--fastapi)
- [Summary](#summary)

---

## Infrastructure

| ID   | Severity     | Issue                                                        | Impact                                                            |
| ---- | ------------ | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| I-1  | **Critical** | No `Dockerfile` or `docker-compose.yml` anywhere in the repo | Cannot run via `docker compose up --build` as every README states |
| I-2  | **High**     | `BEACH_SERVICE_URL` missing from root `.env.example`         | Gateway never registers beach proxy routes; all beach API calls return 404 |

---

## Gateway (Go)

Service directory: `gateway/`

### G-1 — Race condition in rate limiter

| Field    | Value                   |
| -------- | ----------------------- |
| File     | `ratelimit.go:58-67`    |
| Severity | Medium                  |

The `allow()` method reads `w.count`, releases the lock, checks the value against the limit outside the lock, then re-acquires the lock to increment. Between the first unlock and the second lock another goroutine can read the same value and also pass the check (TOCTOU race). Under moderate concurrency this allows burst traffic slightly above the configured limit.

### G-2 — CORS rejects all origins when env var is empty

| Field    | Value                |
| -------- | -------------------- |
| File     | `cors.go:27-29`      |
| Severity | Medium (config risk) |

When `CORS_ALLOWED_ORIGINS` is empty or misconfigured, no origin matches `originSet`, so no CORS headers are ever set. The browser treats every cross-origin request (including from `http://localhost:5173`) as a CORS failure. Not a code bug per se, but a silent misconfiguration trap.

---

## Airport (Python / Flask)

Service directory: `services/airport/`

### A-1 — Priority queue uses LIFO instead of FIFO within the same tier

| Field    | Value                |
| -------- | -------------------- |
| File     | `gate_manager.py:40` |
| Severity | **High**             |

The insertion condition `if _effective_rank(existing) >= rank` uses `>=` instead of `>`. When a newly arriving guest has the **same** priority rank as existing guests, they are inserted **before** all of them instead of after. This creates last-in-first-out ordering within a priority tier.

**Fix:** Change `>=` to `>`.

### A-2 — `wait_time_seconds` only measures processing time

| Field    | Value                |
| -------- | -------------------- |
| File     | `gate_manager.py:74` |
| Severity | **High**             |

```python
processed_at = game_now()
wait_time = processed_at - started_at
```

`started_at` is set at line 70, right before the processing sleep. The result is only the processing duration, not the total time from entering the queue to being processed. The data model and README both define `wait_time_seconds` as `processed_at - queued_at`.

**Fix:** Change to `wait_time = processed_at - guest["queued_at"]`.

---

## Hotel (NestJS / Prisma)

Service directory: `services/hotel/`

### H-1 — SQL injection in `findActiveByGuestId`

| Field    | Value                          |
| -------- | ------------------------------ |
| File     | `reservation.service.ts:162`   |
| Severity | **Critical**                   |

```ts
WHERE r.guest_id = ${Prisma.raw(`'${guestId}'`)}
```

`Prisma.raw()` interpolates the user-supplied `guestId` directly into the SQL query string, bypassing Prisma's parameterisation. The `guestId` comes from the URL path (`/reservation/by-guest/:guest_id`), so it is fully attacker-controlled.

**Fix:** Use `${guestId}` directly inside `Prisma.sql` (auto-parameterised).

### H-2 — SQL injection in `cancel`

| Field    | Value                          |
| -------- | ------------------------------ |
| File     | `reservation.service.ts:191`   |
| Severity | **Critical**                   |

Same pattern as H-1:

```ts
Prisma.sql`UPDATE "Reservation" SET status = 'CANCELLED' WHERE id = ${Prisma.raw(`'${id}'`)}`
```

The `id` comes from the URL path (`/reservation/:id`), so it is user-controlled.

**Fix:** Replace `${Prisma.raw(`'${id}'`)}` with `${id}`.

### H-3 — Airport processing check is a no-op

| Field    | Value                                                    |
| -------- | -------------------------------------------------------- |
| File     | `airport.service.ts:22-24`, `airport-arrival-response.dto.ts:5` |
| Severity | **High**                                                 |

The DTO defines `isProcessed: boolean` (camelCase), but the airport service returns `status: "processed"` (snake_case string field). There is no `isProcessed` field in the airport response at all.

The result: `body.isProcessed` is always `undefined`. The function `hasGuestClearedProcessing` returns `undefined` (neither `true` nor `false`), and the caller checks `hasClearedAirport === false` (strict equality), which never matches `undefined`. Guests who are still in the airport queue are **never rejected** — the check is effectively dead code.

**Fix:** Parse the airport response correctly: check `body.status === "processed"`.

### H-4 — Reservation created before airport check, no rollback

| Field    | Value                              |
| -------- | ---------------------------------- |
| File     | `reservation.service.ts:77-88`     |
| Severity | **High**                           |

```ts
const reservation = await this.prisma.reservation.create({ ... });  // line 77
await this.rejectIfGuestHasNotClearedAirport(reservation.guest_id); // line 88
```

The reservation is persisted first, then the airport check runs. If the check throws an `HttpException`, the CONFIRMED reservation remains in the database with no rollback or cleanup.

**Fix:** Run the airport check before creating the reservation, or wrap both in a transaction with rollback.

---

## Broadcast (Node / Express SSE)

Service directory: `services/broadcast/`

### B-1 — `addClient` is a no-op (SSE completely broken)

| Field    | Value              |
| -------- | ------------------ |
| File     | `eventBus.ts:7`    |
| Severity | **Critical**       |

```ts
export function addClient(res: Response) {
  //TODO: Add client
}
```

The function body is a TODO comment. No SSE client is ever pushed into the `clients` array. `broadcast()` iterates over an always-empty array. The entire real-time event system is dead.

**Fix:** Push the response object into the `clients` array and set up cleanup on connection close.

### B-2 — Default port is 3000, should be 3002

| Field    | Value               |
| -------- | ------------------- |
| File     | `.env.example:1`, `server.ts:15` |
| Severity | **High**            |

The broadcast `.env.example` sets `PORT=3000` and the code defaults to `3000`. The root `.env.example` and main README both say broadcast runs on port **3002** (`BROADCAST_SERVICE_URL=http://broadcast:3002`). Port 3000 conflicts with the hotel service.

**Fix:** Change the default to `3002`.

### B-3 — No `/health` endpoint

| Field    | Value         |
| -------- | ------------- |
| File     | `server.ts`   |
| Severity | **High**      |

The gateway's aggregated health check calls `GET /health` on every configured service. Broadcast has no such route. The gateway will always report broadcast as unhealthy/degraded.

**Fix:** Add `app.get("/health", (_, res) => res.json({ status: "healthy" }))`.

### B-4 — Payload destructuring extracts wrong field

| Field    | Value                                                  |
| -------- | ------------------------------------------------------ |
| File     | `routes/airport.ts:9`, `routes/hotel.ts:10`, `routes/beach.ts:9` |
| Severity | **High**                                               |

All ingest routes do:

```ts
const { body } = req.body;
```

This destructures a `body` field from the parsed JSON. But the airport service sends a flat object with fields `channel`, `message`, `sender`, `data` — there is no nested `body` field. Result: `body` is always `undefined`, and every broadcasted event has `payload: { body: undefined }`.

**Fix:** Use `req.body` directly, e.g. `const data = req.body;`.

### B-5 — Event shape mismatch with frontend Zod schemas

| Field    | Value                         |
| -------- | ----------------------------- |
| File     | `eventBus.ts:18-22` vs frontend `BroadcastEventSchema` |
| Severity | **Critical**                  |

The broadcast backend emits events shaped as:

```json
{ "id": "...", "type": "...", "timestamp": "...", "source": "...", "payload": {...} }
```

The frontend `BroadcastEventSchema` expects:

```json
{ "id": "...", "channel": "...", "event_type": "...", "message": "...", "sender": "...", "data": {...} }
```

Field names do not match (`type` vs `event_type`, `source` vs `sender`), and the frontend requires `channel` and `message` which the backend never sends. Even if SSE were working, every event would fail Zod validation and be silently dropped.

**Fix:** Align one side to match the other.

### B-6 — `/available` route uses `BEACH_FULL` event type

| Field    | Value                |
| -------- | -------------------- |
| File     | `routes/beach.ts:30` |
| Severity | Medium               |

The beach `/available` route broadcasts with `EventType.BEACH_FULL` instead of a `BEACH_AVAILABLE` type. There is no `BEACH_AVAILABLE` enum value defined. An activity becoming available would be broadcast as "full".

**Fix:** Add a `BEACH_AVAILABLE` event type and use it.

### B-7 — Typo in `HOTEL_CONFIRM` event type string

| Field    | Value          |
| -------- | -------------- |
| File     | `types.ts:4`   |
| Severity | Medium         |

```ts
HOTEL_CONFIRM = "hotel.reservaiton_confirmed"
```

"reservaiton" is misspelled — should be "reservation". Any consumer comparing against the correct string will never match.

**Fix:** Change to `"hotel.reservation_confirmed"`.

---

## Beach (Kotlin / Ktor)

Service directory: `services/beach/`

### BE-1 — Bookings are never persisted to the database

| Field    | Value                               |
| -------- | ----------------------------------- |
| File     | `PostgresActivityRepository.kt`     |
| Severity | **Critical**                        |

The `Activity` domain model has a `bookedVisitors: MutableSet<String>` field, but:

- There is **no bookings table** in the database.
- `findById()` creates `Activity` objects with an **empty** `bookedVisitors` set every time.
- `save()` only persists `name`, `description`, `capacity` — not bookings.

All bookings are lost on every request. `remaining()` always equals `capacity`.

**Fix:** Create a `bookings` table and persist the guest-to-activity relationship.

### BE-2 — `BookActivityUseCase` has no validation

| Field    | Value                            |
| -------- | -------------------------------- |
| File     | `BookActivityUseCase.kt:12-21`   |
| Severity | **Critical**                     |

The `execute()` method:

- **No null check:** `activity!!` throws NPE if `findById()` returns null (activity not found).
- **No visitor existence check:** `VisitorRepository` is injected but never used.
- **No capacity check:** Never calls `activity.isFull()`.
- **No duplicate-booking check:** Never checks if the visitor is already in `bookedVisitors`.
- **Always returns `null`:** The controller never gets an error signal.

### BE-3 — `CancelActivityUseCase` has no validation

| Field    | Value                             |
| -------- | --------------------------------- |
| File     | `CancelActivityUseCase.kt:10-19`  |
| Severity | **High**                          |

Same pattern as BE-2: no null check (NPE), no check whether the visitor actually has a booking, always returns `null`.

### BE-4 — Controller always returns 200 OK

| Field    | Value                              |
| -------- | ---------------------------------- |
| File     | `ActivityController.kt:23-61`      |
| Severity | **High**                           |

Both `book()` and `cancel()` ignore the use case return value (which is always `null` anyway) and unconditionally respond with `200 OK` and `{"status": "booked"}` or `{"status": "cancelled"}`.

**Fix:** Check error return values and respond with appropriate HTTP status codes.

### BE-5 — No `/health` endpoint

| Field    | Value          |
| -------- | -------------- |
| File     | `Routing.kt`   |
| Severity | **High**       |

The gateway calls `GET /health` on all backends. Beach has no health route, so it returns 404, causing the gateway to report it as degraded.

**Fix:** Add a `get("/health")` route.

### BE-6 — CORS not installed

| Field    | Value                    |
| -------- | ------------------------ |
| File     | `Application.kt:12-17`  |
| Severity | **High**                 |

`Application.module()` calls `configureSerialization()` and `configureRouting()` but never calls `configureHttp()`. The CORS plugin defined in `plugins/Http.kt` is never installed. Cross-origin requests from the frontend will be blocked.

**Fix:** Add `configureHttp()` call in `Application.module()`.

---

## Frontend (React / Vite)

Service directory: `frontend/`

### F-1 — Beach API client has no base path

| Field    | Value                |
| -------- | -------------------- |
| File     | `api-client.ts:77`   |
| Severity | **Critical**         |

```ts
api.beach = createJsonApi()  // missing "/api/beach"
```

All other services pass their path: `"/api/airport"`, `"/api/hotel"`, `"/api/parrot"`. Beach gets an empty string. Calls like `getActivities()` hit `http://localhost:8000/activities` instead of `http://localhost:8000/api/beach/activities`. Every beach request returns 404.

**Fix:** Change to `createJsonApi("/api/beach")`.

### F-2 — Hotel room schema expects wrong field name

| Field    | Value                    |
| -------- | ------------------------ |
| File     | `hotel/types.ts:29`      |
| Severity | **High**                 |

The frontend Zod schema expects a field called `occupancy`, but the hotel service returns `current_guests`. Zod strict parsing rejects the response (or drops the field to `undefined`), breaking room display.

**Fix:** Rename the Zod field to `current_guests`, or add a transform.

### F-3 — Simulation time anchor is hardcoded

| Field    | Value                       |
| -------- | --------------------------- |
| File     | `simulation-time.ts:7`      |
| Severity | **High**                    |

```ts
const anchor = new Date("2026-06-19T09:00:00Z");  // hardcoded
```

This ignores `env.simulationStartTime`. Three conflicting values exist across the codebase:

- Hardcoded: `2026-06-19T09:00:00Z`
- Frontend env default: `2026-06-14T09:00:00Z`
- Root `.env.example`: `2026-06-20T00:00:00Z`

Reservation day calculations (check-in/check-out) will be wrong.

**Fix:** Read from `env.simulationStartTime` (or `import.meta.env.VITE_SIMULATION_START_TIME`).

---

## Parrot (Python / FastAPI)

Service directory: `services/parrot/`

**No blocking bugs found.** The service is well-structured and functional. Minor observations:

- `profanity.py:15` — `contains_mask` checks for `*` anywhere in text, producing false positives in admin metrics if a user naturally types `*`.
- `tools.py:88-91` — Guest-specific tools use the `guest_id` from LLM tool arguments rather than validating against the authenticated `allowed_guest_id` (privacy gap, noted as a design choice).

---

## Summary

### Bug count by service

| Service   | Critical | High | Medium | Total |
| --------- | -------: | ---: | -----: | ----: |
| Infra     |        1 |    1 |      0 |     2 |
| Gateway   |        0 |    0 |      2 |     2 |
| Airport   |        0 |    2 |      0 |     2 |
| Hotel     |        2 |    2 |      0 |     4 |
| Broadcast |        2 |    3 |      2 |     7 |
| Beach     |        2 |    4 |      0 |     6 |
| Frontend  |        1 |    2 |      0 |     3 |
| Parrot    |        0 |    0 |      0 |     0 |
| **Total** |    **8** |**14**|    **4**|**26** |

### Top blockers preventing the application from running

1. **No Docker infrastructure** (I-1) — cannot start services as documented
2. **Broadcast SSE is dead** (B-1) — real-time event system non-functional
3. **Broadcast event shape mismatch** (B-5) — even if SSE worked, frontend drops everything
4. **Beach bookings not persisted** (BE-1) — all bookings lost immediately
5. **Beach has no validation** (BE-2, BE-3, BE-4) — NPEs and silent failures
6. **Hotel SQL injection** (H-1, H-2) — security vulnerability
7. **Hotel airport check is dead code** (H-3) — business rule not enforced
8. **Frontend beach API path missing** (F-1) — beach UI completely broken
9. **Airport queue ordering wrong** (A-1) — fairness violation
10. **Simulation time mismatch** (F-3) — day calculations drift across services

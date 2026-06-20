# Island Announcement Service

## Overview

The Island Announcement Service is a centralized real-time notification hub for the island ecosystem.

It allows island services (Airport, Hotel, Beach, etc.) and guests to publish events that are immediately broadcast to all connected clients using Server-Sent Events (SSE).

The service acts as the communication layer between island components and provides a single source for real-time announcements.

---


# Running the Application

## Local Development

Install dependencies:

```bash
npm install
```

Start the application:

```bash
npm run dev
```

Default URL:

```text
http://localhost:3000
```

---

# Environment Variables

Create a `.env` file:

```env
PORT=3000
CORS_ORIGIN=*
```

| Variable    | Description         | Default |
| ----------- | ------------------- | ------- |
| PORT        | Application port    | 3000    |
| CORS_ORIGIN | Allowed CORS origin | *       |

---

# API Endpoints

---

## SSE Stream

### Connect to Event Stream

```http
GET /events
```

Returns a continuous stream of island announcements — **for the channels the
caller is authorised to receive only** (see Access Control below).

### Example

```bash
curl -N http://localhost:3000/events -H "X-Service-Token: fe-token"
```

Example response:

```text

event: public.announcement
data: {id: uuid, event: EventType, timestamp: Date, source: String, payload: {}}
```

---

## Access Control

`GET /events` requires the caller to identify itself with a per-service bearer
token — one of the `*_TOKEN` values in the root `.env` (`FE_TOKEN`,
`HOTEL_TOKEN`, `BEACH_TOKEN`, `AIRPORT_TOKEN`, `PARROT_TOKEN`). A missing or
unrecognized token gets **no stream at all** (`401`) — there is no anonymous
or default-access fallback.

The token can be sent as:

- `Authorization: Bearer <token>`
- `X-Service-Token: <token>`
- `?token=<token>` query parameter — for the frontend's browser `EventSource`,
  which cannot set custom headers

Once identified, a connection only ever receives events on the channels its
service is granted below — every other channel is silently filtered, never
delivered. This is independent of publish access: any service can still POST
to any ingest route, as before. Granted strictly on actual consumption
(least privilege):

| Service  | Token         | Receives                          | Why                                                                 |
| -------- | ------------- | ---------------------------------- | -------------------------------------------------------------------- |
| Frontend | `FE_TOKEN`    | every channel                      | Renders every zone's live feed — airport, hotel, beach, crab, parrot, public, admin |
| Beach    | `BEACH_TOKEN` | `hotel`                             | Listens for `hotel.reservation_confirmed` to mark guests checked in |
| Hotel    | `HOTEL_TOKEN` | *(none)*                           | Only publishes — never subscribes                                  |
| Airport  | `AIRPORT_TOKEN` | *(none)*                          | Only publishes — must not see public announcements or anything else |
| Parrot   | `PARROT_TOKEN`  | *(none)*                          | Only publishes (`/cursed`) — never subscribes                      |

Publishing (every `POST` route below) is unrestricted, matching the existing
behaviour — this access control only governs what a listener gets back.

---

## Airport

### Guest Arrival

```http
POST /airport/arrival
```

---

## Hotel

```http
POST /hotel/confirm
```

```http
POST /hotel/cancel
```
---

## Beach

```http
POST /beach/full
```

```http
POST /beach/available
```

---

## Parrot

### Profanity Detected

```http
POST /cursed
```

Published by the Parrot service when a guest's chat message trips the profanity filter.
Emits a public notification on the `parrot` channel.

Payload:

```json
{
  "guest_id": "guest-kiki-0001",
  "message": "This damn parrot",
  "triggered_word": ["damn"]
}
```

---

## Public Announcements

```http
POST /public
```

---

# Event Types

The service currently supports the following event types:

| Event Type                            | Description                    |
| ------------------------------------- | ------------------------------ |
| airport.arrival                       | Guest arrived on the island    |
| hotel.reservation_confirmed           | Guest checked into the hotel   |
| hotel.reservation_canceled            | Guest canceled hotel stay      |
| beach.activity_full                   | Beach activity reached capacity|
| beach.activity_available              | Beach activity available       |
| parrot.cursed                         | Guest's chat message contained profanity |
| public.announcement                   | Guest broadcast message        |

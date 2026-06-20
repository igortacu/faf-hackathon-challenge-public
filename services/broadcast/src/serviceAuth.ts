import { Request } from "express";
import { ChannelId } from "./types.js";

export interface ServiceIdentity {
  name: string;
  allowedChannels: ReadonlySet<ChannelId>;
}

// Which broadcast channels each service may *receive* over GET /events. This is
// independent of publish access (POST routes are unrestricted, as before) — it
// only governs what a listener is handed back.
//
// Granted strictly on actual consumption, least-privilege: the frontend renders
// every zone's live feed, so it needs every channel; Beach listens only for
// `hotel.reservation_confirmed` to mark guests checked in (see
// HotelCheckInBroadcastClient.kt). Every other service only publishes today, so
// it gets no read entitlements at all — e.g. Airport must not be able to listen
// to public announcements, or anything else.
const SERVICE_REGISTRY: Record<string, { envVar: string; allowedChannels: ChannelId[] }> = {
  frontend: { envVar: "FE_TOKEN", allowedChannels: Object.values(ChannelId) },
  hotel: { envVar: "HOTEL_TOKEN", allowedChannels: [] },
  beach: { envVar: "BEACH_TOKEN", allowedChannels: [ChannelId.Hotel] },
  airport: { envVar: "AIRPORT_TOKEN", allowedChannels: [] },
  parrot: { envVar: "PARROT_TOKEN", allowedChannels: [] },
};

function extractToken(req: Request): string | undefined {
  const auth = req.header("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();

  const headerToken = req.header("x-service-token");
  if (headerToken) return headerToken;

  // Query param fallback: a browser EventSource cannot set custom headers, so
  // the frontend authenticates via ?token=... instead.
  const queryToken = req.query.token;
  if (typeof queryToken === "string") return queryToken;

  return undefined;
}

/**
 * Identifies the calling service from its bearer token. Env vars are read live
 * on every call (not cached at import time) so tests can set them per-run, the
 * same way adminAuth.ts reads ADMIN_PASSCODE lazily.
 *
 * Returns null for a missing or unrecognized token — callers must fail closed.
 */
export function identifyService(req: Request): ServiceIdentity | null {
  const token = extractToken(req);
  if (!token) return null;

  for (const [name, { envVar, allowedChannels }] of Object.entries(SERVICE_REGISTRY)) {
    const configured = process.env[envVar];
    if (configured && token === configured) {
      return { name, allowedChannels: new Set(allowedChannels) };
    }
  }

  return null;
}

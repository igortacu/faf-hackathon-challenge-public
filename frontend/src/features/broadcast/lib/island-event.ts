import { ChannelId } from "@/types/broadcast";
import type { BroadcastEvent } from "@/types/broadcast";
import type { Activity } from "@/features/beach/types";

interface IslandEvent {
  id: string;
  type: string;
  source: string;
  timestamp?: string;
  payload?: unknown;
}

export interface BeachAvailabilityPayload {
  activityId: string;
  activityName?: string;
  capacity?: number;
  remaining: number;
}

export const BEACH_ACTIVITY_EVENT_TYPES = [
  "beach.activity_full",
  "beach.activity_available",
] as const;

export function normalizeIslandEvent(event: IslandEvent): BroadcastEvent | null {
  if (event.source === "beach") {
    return normalizeBeachEvent(event);
  }

  return null;
}

export function parseIslandEventMessage(data: string): BroadcastEvent | null {
  try {
    return normalizeIslandEvent(JSON.parse(data) as IslandEvent);
  } catch {
    return null;
  }
}

export function getBeachAvailabilityPayload(
  event: BroadcastEvent
): BeachAvailabilityPayload | null {
  if (
    event.channel !== ChannelId.Beach ||
    !BEACH_ACTIVITY_EVENT_TYPES.includes(
      event.event_type as (typeof BEACH_ACTIVITY_EVENT_TYPES)[number]
    )
  ) {
    return null;
  }

  const data = event.data;
  if (!data || typeof data.activityId !== "string") {
    return null;
  }

  const remaining =
    typeof data.remaining === "number" ? data.remaining : Number.NaN;

  if (!Number.isFinite(remaining)) {
    return null;
  }

  return {
    activityId: data.activityId,
    activityName:
      typeof data.activityName === "string" ? data.activityName : undefined,
    capacity: typeof data.capacity === "number" ? data.capacity : undefined,
    remaining,
  };
}

export function updateActivitiesFromBeachEvent(
  activities: Activity[],
  payload: Pick<BeachAvailabilityPayload, "activityId" | "remaining">
): Activity[] {
  return activities.map((activity) =>
    activity.activity_id === payload.activityId
      ? { ...activity, remaining: payload.remaining }
      : activity
  );
}

function normalizeBeachEvent(event: IslandEvent): BroadcastEvent | null {
  if (
    !BEACH_ACTIVITY_EVENT_TYPES.includes(
      event.type as (typeof BEACH_ACTIVITY_EVENT_TYPES)[number]
    )
  ) {
    return null;
  }

  const payload = getPayloadObject(event.payload);
  if (!payload || typeof payload.activityId !== "string") {
    return null;
  }

  const activityName =
    typeof payload.activityName === "string"
      ? payload.activityName
      : payload.activityId;
  const remaining =
    typeof payload.remaining === "number" ? payload.remaining : Number.NaN;

  if (!Number.isFinite(remaining)) {
    return null;
  }

  return {
    id: event.id,
    channel: ChannelId.Beach,
    event_type: event.type,
    message:
      event.type === "beach.activity_full"
        ? `${activityName} is now full.`
        : `A space opened up for ${activityName}.`,
    sender: "beach-service",
    data: {
      activityId: payload.activityId,
      activityName,
      capacity: payload.capacity,
      remaining,
    },
  };
}

function getPayloadObject(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return payload as Record<string, unknown>;
}

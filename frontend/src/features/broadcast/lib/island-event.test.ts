import { describe, expect, it } from "vitest";

import { ChannelId } from "@/types/broadcast";
import {
  normalizeIslandEvent,
  updateActivitiesFromBeachEvent,
} from "@/features/broadcast/lib/island-event";
import type { Activity } from "@/features/beach/types";

describe("normalizeIslandEvent", () => {
  it("normalizes beach full events into UI broadcast events", () => {
    expect(
      normalizeIslandEvent({
        id: "event-1",
        type: "beach.activity_full",
        source: "beach",
        payload: {
          activityId: "ACT001",
          activityName: "Beach Volleyball",
          capacity: 2,
          remaining: 0,
        },
      })
    ).toEqual({
      id: "event-1",
      channel: ChannelId.Beach,
      event_type: "beach.activity_full",
      message: "Beach Volleyball is now full.",
      sender: "beach-service",
      data: {
        activityId: "ACT001",
        activityName: "Beach Volleyball",
        capacity: 2,
        remaining: 0,
      },
    });
  });

  it("normalizes beach available events into UI broadcast events", () => {
    expect(
      normalizeIslandEvent({
        id: "event-2",
        type: "beach.activity_available",
        source: "beach",
        payload: {
          activityId: "ACT001",
          activityName: "Beach Volleyball",
          capacity: 2,
          remaining: 1,
        },
      })
    ).toMatchObject({
      channel: ChannelId.Beach,
      event_type: "beach.activity_available",
      message: "A space opened up for Beach Volleyball.",
    });
  });
});

describe("updateActivitiesFromBeachEvent", () => {
  it("patches matching activity remaining slots from beach events", () => {
    const activities: Activity[] = [
      {
        activity_id: "ACT001",
        activity_name: "Beach Volleyball",
        description: "Competitive beach volleyball tournament.",
        capacity: 2,
        remaining: 1,
      },
    ];

    expect(
      updateActivitiesFromBeachEvent(activities, {
        activityId: "ACT001",
        remaining: 0,
      })
    ).toEqual([
      {
        activity_id: "ACT001",
        activity_name: "Beach Volleyball",
        description: "Competitive beach volleyball tournament.",
        capacity: 2,
        remaining: 0,
      },
    ]);
  });
});

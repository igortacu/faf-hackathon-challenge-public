import { create } from "zustand";

import { ChannelId } from "@/types/broadcast";
import type { BroadcastEvent } from "@/types/broadcast";

const MAX_EVENTS = 100;
const ADMIN_ANNOUNCEMENT_EVENT_TYPE = "admin.announcement";
const ALL_CHANNELS = Object.values(ChannelId);

interface IngestEventOptions {
  mirrorToResortWide?: boolean;
}

interface EventsState {
  events: Record<ChannelId, BroadcastEvent[]>;
  activityTick: Record<ChannelId, number>;
  ingestEvent: (event: BroadcastEvent, options?: IngestEventOptions) => void;
  clearEvents: (channel: ChannelId) => void;
}

function createEmptyChannelEvents(): Record<ChannelId, BroadcastEvent[]> {
  return {
    [ChannelId.Airport]: [],
    [ChannelId.Hotel]: [],
    [ChannelId.Beach]: [],
    [ChannelId.Crab]: [],
    [ChannelId.Parrot]: [],
    [ChannelId.Broadcast]: [],
    [ChannelId.ResortWide]: [],
  };
}

function createEmptyActivityTicks(): Record<ChannelId, number> {
  return {
    [ChannelId.Airport]: 0,
    [ChannelId.Hotel]: 0,
    [ChannelId.Beach]: 0,
    [ChannelId.Crab]: 0,
    [ChannelId.Parrot]: 0,
    [ChannelId.Broadcast]: 0,
    [ChannelId.ResortWide]: 0,
  };
}

function prependEvent(events: BroadcastEvent[], event: BroadcastEvent) {
  const next = [event, ...events];

  if (next.length > MAX_EVENTS) {
    next.length = MAX_EVENTS;
  }

  return next;
}

export const useEventsStore = create<EventsState>()((set) => ({
  events: createEmptyChannelEvents(),
  activityTick: createEmptyActivityTicks(),

  ingestEvent: (event, options) =>
    set((state) => {
      // Resort-wide admin announcements are delivered as a single SSE event
      // but must appear in every zone's own feed, not just the Lighthouse/
      // resort-wide one — fan it out to every channel bucket instead of just
      // its own channel (+ optional mirror).
      if (event.event_type === ADMIN_ANNOUNCEMENT_EVENT_TYPE) {
        const nextEvents = { ...state.events };
        const nextActivityTick = { ...state.activityTick };

        for (const channel of ALL_CHANNELS) {
          nextEvents[channel] = prependEvent(state.events[channel], {
            ...event,
            id: crypto.randomUUID(),
            channel,
          });
          nextActivityTick[channel] = state.activityTick[channel] + 1;
        }

        return { events: nextEvents, activityTick: nextActivityTick };
      }

      const nextEvents = {
        ...state.events,
        [event.channel]: prependEvent(state.events[event.channel], event),
      };

      const nextActivityTick = {
        ...state.activityTick,
        [event.channel]: state.activityTick[event.channel] + 1,
      };

      const shouldMirrorToResortWide =
        options?.mirrorToResortWide && event.channel !== ChannelId.ResortWide;
      if (shouldMirrorToResortWide) {
        const mirroredEvent: BroadcastEvent = {
          ...event,
          id: crypto.randomUUID(),
          channel: ChannelId.ResortWide,
        };

        nextEvents[ChannelId.ResortWide] = prependEvent(
          state.events[ChannelId.ResortWide],
          mirroredEvent
        );
        nextActivityTick[ChannelId.ResortWide] =
          state.activityTick[ChannelId.ResortWide] + 1;
      }

      return {
        events: nextEvents,
        activityTick: nextActivityTick,
      };
    }),

  clearEvents: (channel) =>
    set((state) => ({
      events: { ...state.events, [channel]: [] },
    })),
}));

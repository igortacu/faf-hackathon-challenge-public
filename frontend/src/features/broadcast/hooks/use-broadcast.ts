import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { env } from "@/config/env";
import {
  BEACH_ACTIVITY_EVENT_TYPES,
  getBeachAvailabilityPayload,
  parseIslandEventMessage,
  updateActivitiesFromBeachEvent,
} from "@/features/broadcast/lib/island-event";
import { BEACH_KEYS } from "@/features/beach/query-keys";
import type { ActivitiesResponse } from "@/features/beach/types";
import { useEventsStore } from "@/stores/events-store";
import { BroadcastEventSchema } from "@/types/broadcast";
import type { BroadcastEvent } from "@/types/broadcast";
import type { ConnectionStatus } from "@/types/broadcast";

const BACKOFF_INITIAL_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;

const BROADCAST_PATH = "/api/broadcast/events";

export function useBroadcast() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ConnectionStatus>(() => {
    if (!env.gatewayUrl) {
      console.warn(
        "[useBroadcast] VITE_GATEWAY_URL is not set — SSE connections skipped"
      );
      return "dropped";
    }
    return "reconnecting";
  });
  const connectionRef = useRef<EventSource | null>(null);
  const backoffRef = useRef(BACKOFF_INITIAL_MS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(true);

  useEffect(() => {
    if (!env.gatewayUrl) return;

    activeRef.current = true;

    function connect() {
      if (!activeRef.current) return;

      const base = env.gatewayUrl.replace(/\/+$/, "");
      const es = new EventSource(`${base}${BROADCAST_PATH}`);
      connectionRef.current = es;

      es.onopen = () => {
        backoffRef.current = BACKOFF_INITIAL_MS;
        setStatus("connected");
      };

      const ingestBroadcastEvent = (event: BroadcastEvent) => {
        useEventsStore
          .getState()
          .ingestEvent(event, { mirrorToResortWide: true });

        const beachPayload = getBeachAvailabilityPayload(event);
        if (!beachPayload) return;

        let updatedCache = false;
        queryClient.setQueryData<ActivitiesResponse>(
          [...BEACH_KEYS.ACTIVITIES],
          (current) => {
            if (!current) return current;

            updatedCache = true;
            return {
              ...current,
              activities: updateActivitiesFromBeachEvent(
                current.activities,
                beachPayload
              ),
            };
          }
        );

        if (!updatedCache) {
          void queryClient.invalidateQueries({
            queryKey: [...BEACH_KEYS.ACTIVITIES],
          });
        }
      };

      const handleMessage = (e: MessageEvent) => {
        try {
          const rawData = e.data as string;
          const islandEvent = parseIslandEventMessage(rawData);
          if (islandEvent) {
            ingestBroadcastEvent(islandEvent);
            return;
          }

          const parsed = BroadcastEventSchema.safeParse(JSON.parse(rawData));
          if (parsed.success) {
            ingestBroadcastEvent(parsed.data);
          }
        } catch {
          // malformed payload
        }
      };

      es.onmessage = handleMessage;
      BEACH_ACTIVITY_EVENT_TYPES.forEach((eventType) => {
        es.addEventListener(eventType, handleMessage);
      });

      es.onerror = () => {
        es.close();
        connectionRef.current = null;
        setStatus("reconnecting");

        if (!activeRef.current) return;

        const current = backoffRef.current;
        backoffRef.current = Math.min(current * 2, BACKOFF_MAX_MS);

        timerRef.current = setTimeout(() => {
          if (activeRef.current) connect();
        }, current);
      };
    }

    connect();

    return () => {
      activeRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      connectionRef.current?.close();
      connectionRef.current = null;
    };
  }, [queryClient]);

  return { status };
}

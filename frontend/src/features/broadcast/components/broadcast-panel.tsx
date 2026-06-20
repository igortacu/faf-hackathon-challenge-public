import { AnnouncementComposer } from "@/features/broadcast/components/announcement-composer";
import { EventLog } from "@/features/map/components/event-log";
import { ZoneId } from "@/features/map/constants";
import { getZone } from "@/features/map/zone-registry";
import { useEventsStore } from "@/stores/events-store";
import { useIsAdmin } from "@/stores/session-selectors";

const { channel } = getZone(ZoneId.Broadcast);
const PUBLIC_EVENT_PREFIX = "public.";
const ADMIN_ANNOUNCEMENT_EVENT_TYPE = "admin.announcement";

export function BroadcastPanel() {
  const isAdmin = useIsAdmin();
  const events = useEventsStore((s) => s.events[channel]);

  const visible = isAdmin
    ? events
    : events.filter(
        (event) =>
          event.event_type.startsWith(PUBLIC_EVENT_PREFIX) ||
          event.event_type === ADMIN_ANNOUNCEMENT_EVENT_TYPE
      );

  return (
    <>
      {isAdmin && <AnnouncementComposer />}
      <EventLog events={visible} />
    </>
  );
}

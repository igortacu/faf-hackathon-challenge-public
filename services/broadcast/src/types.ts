export enum EventType {
  AIRPORT_ARRIVAL = "airport.arrival",

  HOTEL_CONFIRM = "hotel.reservation_confirmed",
  HOTEL_CANCEL = "hotel.reservation_cancelled",

  BEACH_FULL = "beach.activity_full",
  BEACH_AVAILABLE = "beach.activity_available",

  CRAB_ORDER_PLACED = "crab.order_placed",
  CRAB_SOLD_OUT = "crab.sold_out",

  PARROT_CURSED = "parrot.cursed",

  PUBLIC_ANNOUNCEMENT = "public.announcement",

  ADMIN_ANNOUNCEMENT = "admin.announcement",
}

// Channels mirror the consumer contract (frontend ChannelId). Events are
// bucketed by channel on the listener side, so each route sets the channel of
// its source service; the listener mirrors non-resort-wide channels to the
// resort-wide feed on its own.
export enum ChannelId {
  Airport = "airport",
  Hotel = "hotel",
  Beach = "beach",
  Crab = "crab",
  Parrot = "parrot",
  Broadcast = "broadcast",
  ResortWide = "resort-wide",
}

// IslandEvent is the wire shape delivered to SSE listeners. It matches the
// consumer's BroadcastEventSchema exactly so events pass validation and get
// bucketed by `channel`.
export interface IslandEvent {
  id: string;
  channel: ChannelId;
  event_type: EventType;
  message: string;
  sender: string;
  guest_id?: string;
  guest_name?: string;
  data?: Record<string, unknown>;
}

export enum ChannelId {
  Airport = "airport",
  Hotel = "hotel",
  Beach = "beach",
  Parrot = "parrot",
  Broadcast = "broadcast",
  ResortWide = "resort-wide",
}

export enum EventType {
  AIRPORT_ARRIVAL = "airport.arrival",

  HOTEL_CONFIRM = "hotel.reservation_confirmed",
  HOTEL_CANCEL = "hotel.reservation_cancelled",

  BEACH_FULL = "beach.activity_full",

  PUBLIC_ANNOUNCEMENT = "public.announcement",

  ADMIN_ANNOUNCEMENT = "admin.announcement",
}

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

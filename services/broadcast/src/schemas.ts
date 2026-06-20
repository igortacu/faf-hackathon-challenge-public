import { z } from "zod";

// Every payload schema is `.strict()`: any field not explicitly named here is
// rejected (400) rather than silently collected into a wildcard bag. This is
// the single source of truth for what each producer is allowed to send.

const BaseFields = {
  message: z.string().optional(),
  guest_id: z.string().optional(),
  guest_name: z.string().optional(),
};

export const AirportArrivalSchema = z
  .object({
    ...BaseFields,
    gate: z.string().optional(),
    passport_type: z.string().optional(),
  })
  .strict();

export const HotelEventSchema = z
  .object({
    ...BaseFields,
    reservation_id: z.string().optional(),
    room_type: z.string().optional(),
    guest_count: z.number().optional(),
    check_in_day: z.number().optional(),
    check_out_day: z.number().optional(),
  })
  .strict();

export const BeachEventSchema = z
  .object({
    ...BaseFields,
    activity: z.string().optional(),
  })
  .strict();

const CrabOrderLineSchema = z.object({
  item_id: z.string(),
  name: z.string(),
  emoji: z.string().optional(),
  qty: z.number(),
});

export const CrabOrderSchema = z
  .object({
    ...BaseFields,
    order_id: z.string().optional(),
    items: z.array(CrabOrderLineSchema).optional(),
    total: z.number().optional(),
  })
  .strict();

export const CrabSoldOutSchema = z
  .object({
    ...BaseFields,
    item_id: z.string().optional(),
    name: z.string().optional(),
  })
  .strict();

export const PublicAnnouncementSchema = z
  .object({
    guestName: z.string().min(1, "guestName is required"),
    message: z.string().min(1, "message is required"),
  })
  .strict();

export const AdminAnnouncementSchema = z
  .object({
    message: z.string().min(1, "message is required"),
    sender: z.string().optional(),
  })
  .strict();

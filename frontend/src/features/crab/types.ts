import { z } from "zod";

export const MenuItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string(),
  description: z.string(),
  price: z.number().int(),
  available: z.boolean(),
  remaining: z.number().int().nullable(),
});

export const MenuResponseSchema = z.object({
  items: z.array(MenuItemSchema),
  game_time: z.string(),
});

export const OrderLineSchema = z.object({
  item_id: z.string(),
  name: z.string(),
  emoji: z.string(),
  qty: z.number().int(),
});

export const OrderSchema = z.object({
  id: z.string(),
  guest_id: z.string(),
  guest_name: z.string(),
  items: z.array(OrderLineSchema),
  total: z.number().int(),
  status: z.string(),
  game_time: z.string(),
  created_at: z.string(),
});

export const OrdersResponseSchema = z.object({ orders: z.array(OrderSchema) });

export type MenuItem = z.infer<typeof MenuItemSchema>;
export type MenuResponse = z.infer<typeof MenuResponseSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type OrdersResponse = z.infer<typeof OrdersResponseSchema>;

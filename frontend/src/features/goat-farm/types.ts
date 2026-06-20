import { z } from "zod";

export const GoatStockItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  stock: z.number().int(),
  max_stock: z.number().int(),
});

export const GoatStockResponseSchema = z.object({
  items: z.array(GoatStockItemSchema),
  next_restock_at: z.string(),
  seconds_until_restock: z.number().int(),
});

export const GoatPurchaseSchema = z.object({
  purchase_id: z.string(),
  guest_id: z.string(),
  item_id: z.string(),
  item_name: z.string(),
  remaining_stock: z.number().int(),
  purchased_at: z.string(),
  next_restock_at: z.string(),
  seconds_until_restock: z.number().int(),
});

export type GoatStockItem = z.infer<typeof GoatStockItemSchema>;
export type GoatStockResponse = z.infer<typeof GoatStockResponseSchema>;
export type GoatPurchase = z.infer<typeof GoatPurchaseSchema>;

import { api } from "@/lib/api-client";
import {
  GoatPurchaseSchema,
  GoatStockResponseSchema,
  type GoatPurchase,
  type GoatStockResponse,
} from "@/features/goat-farm/types";

export function getGoatFarmStock(): Promise<GoatStockResponse> {
  return api.goatFarm.get(GoatStockResponseSchema, "/stock");
}

export function buyGoatFarmItem(
  guestId: string,
  itemId: string
): Promise<GoatPurchase> {
  return api.goatFarm.post(GoatPurchaseSchema, "/purchase", {
    guest_id: guestId,
    item_id: itemId,
  });
}

import { api } from "@/lib/api-client";
import {
  MenuResponseSchema,
  OrderSchema,
  OrdersResponseSchema,
  type MenuResponse,
  type Order,
  type OrdersResponse,
} from "@/features/crab/types";

export function getMenu(): Promise<MenuResponse> {
  return api.crab.get(MenuResponseSchema, "/menu");
}

export function placeOrder(
  guestId: string,
  guestName: string,
  items: { item_id: string; qty: number }[]
): Promise<Order> {
  return api.crab.post(OrderSchema, "/orders", {
    guest_id: guestId,
    guest_name: guestName,
    items,
  });
}

export function getGuestOrders(guestId: string): Promise<OrdersResponse> {
  return api.crab.get(OrdersResponseSchema, `/orders?guest_id=${guestId}`);
}

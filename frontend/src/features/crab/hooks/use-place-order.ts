import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { placeOrder } from "@/features/crab/api/crab-client";
import { crabKeys } from "@/features/crab/query-keys";

export function usePlaceOrder(guestId: string, guestName: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { item_id: string; qty: number }[]) =>
      placeOrder(guestId, guestName, items),
    onSuccess: (order) => {
      toast.success(`Order up! 🦀 ${order.items.length} item(s) served.`);
      qc.invalidateQueries({ queryKey: crabKeys.menu() });
      qc.invalidateQueries({ queryKey: crabKeys.orders(guestId) });
    },
    onError: (err) => toast.error(err.message),
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { buyGoatFarmItem } from "@/features/goat-farm/api/goat-farm-client";
import { goatFarmKeys } from "@/features/goat-farm/query-keys";

export function useBuyGoatItem(guestId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => buyGoatFarmItem(guestId, itemId),
    onSuccess: (purchase) => {
      toast.success(`${purchase.item_name} added for ${purchase.guest_id}.`);
      qc.invalidateQueries({ queryKey: goatFarmKeys.stock() });
    },
    onError: (err) => toast.error(err.message),
  });
}

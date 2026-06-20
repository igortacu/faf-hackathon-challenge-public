import { useQuery } from "@tanstack/react-query";

import { getGoatFarmStock } from "@/features/goat-farm/api/goat-farm-client";
import { goatFarmKeys } from "@/features/goat-farm/query-keys";

export function useGoatStock(enabled: boolean) {
  return useQuery({
    queryKey: goatFarmKeys.stock(),
    queryFn: getGoatFarmStock,
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

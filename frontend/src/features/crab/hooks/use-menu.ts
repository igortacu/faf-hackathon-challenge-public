import { useQuery } from "@tanstack/react-query";
import { getMenu } from "@/features/crab/api/crab-client";
import { crabKeys } from "@/features/crab/query-keys";

export function useMenu() {
  return useQuery({
    queryKey: crabKeys.menu(),
    queryFn: getMenu,
    refetchInterval: 15_000,
  });
}

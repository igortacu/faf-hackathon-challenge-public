import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getReservationByGuest,
  cancelReservation,
} from "@/features/hotel/api/hotel-client";
import { useSessionStore } from "@/stores/session-store";
import { HOTEL_KEYS } from "@/features/hotel/query-keys";

export function useActiveReservation() {
  const guest = useSessionStore((s) => s.guest);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...HOTEL_KEYS.RESERVATION, guest?.id],
    queryFn: () => getReservationByGuest(guest!.id),
    enabled: !!guest,
  });

  const mutation = useMutation({
    mutationFn: (id: string) => cancelReservation(id),
    onSuccess: () => {
      // Evict the reservation entry entirely so the query goes back to
      // pending state and the cancel card disappears immediately.
      // invalidateQueries alone only marks it stale — the stale data would
      // keep showing while the background refetch is in flight, re-enabling
      // the cancel button before the 404 comes back.
      queryClient.removeQueries({
        queryKey: [...HOTEL_KEYS.RESERVATION, guest?.id],
      });
      queryClient.invalidateQueries({ queryKey: [...HOTEL_KEYS.ROOMS] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return {
    reservation: query.data ?? null,
    isLoading: query.isLoading,
    cancel: (id: string) => mutation.mutate(id),
    isCancelling: mutation.isPending,
  };
}

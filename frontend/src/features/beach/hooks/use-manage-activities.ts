import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  createActivity,
  removeActivity,
} from "@/features/beach/api/beach-client";
import { BEACH_KEYS } from "@/features/beach/query-keys";
import type { CreateActivityRequest } from "@/features/beach/types";
import { useAdminSession } from "@/stores/session-selectors";

export function useManageActivities() {
  const admin = useAdminSession();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [...BEACH_KEYS.ACTIVITIES] });

  const createMutation = useMutation({
    mutationFn: (body: CreateActivityRequest) => {
      if (!admin) {
        throw new Error("Admin session required to add an activity.");
      }
      return createActivity(body, admin.passcode);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Activity added.");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (activityId: string) => {
      if (!admin) {
        throw new Error("Admin session required to remove an activity.");
      }
      return removeActivity(activityId, admin.passcode);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Activity removed.");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    create: createMutation.mutate,
    isCreating: createMutation.isPending,
    remove: removeMutation.mutate,
    isRemoving: removeMutation.isPending,
  };
}

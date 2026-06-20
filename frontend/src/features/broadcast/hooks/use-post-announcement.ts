import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { postAnnouncement } from "@/features/broadcast/api/broadcast-client";
import { useAdminSession } from "@/stores/session-selectors";

export function usePostAnnouncement() {
  const admin = useAdminSession();

  const mutation = useMutation({
    mutationFn: (message: string) => {
      if (!admin) {
        throw new Error("Admin session required to publish an announcement.");
      }
      return postAnnouncement(message, admin.passcode);
    },
    onSuccess: () => {
      toast.success("Announcement broadcast resort-wide.");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    publish: mutation.mutate,
    isPublishing: mutation.isPending,
  };
}

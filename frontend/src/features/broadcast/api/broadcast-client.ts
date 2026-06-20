import { z } from "zod";

import { api } from "@/lib/api-client";

const PostAnnouncementResponseSchema = z.object({ success: z.boolean() });

export function postAnnouncement(message: string, passcode: string) {
  return api.broadcast.post(
    PostAnnouncementResponseSchema,
    "/admin/announcement",
    { message },
    { "X-Admin-Passcode": passcode }
  );
}

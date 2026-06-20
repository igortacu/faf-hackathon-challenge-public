import { Router } from "express";
import { v4 as uuid } from "uuid";
import { requireAdmin } from "../adminAuth.js";
import { broadcast } from "../eventBus.js";
import { AdminAnnouncementSchema } from "../schemas.js";
import { ChannelId, EventType } from "../types.js";
import { parseBody } from "../validate.js";

const router = Router();

router.post("/announcement", requireAdmin, (req, res) => {
  const body = parseBody(AdminAnnouncementSchema, req, res);
  if (!body) return;

  const { message, sender } = body;

  broadcast({
    id: uuid(),
    channel: ChannelId.ResortWide,
    event_type: EventType.ADMIN_ANNOUNCEMENT,
    message,
    sender: sender ?? "Admin",
  });

  res.json({
    success: true,
  });
});

export default router;

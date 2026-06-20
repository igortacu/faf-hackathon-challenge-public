import { Router } from "express";
import { v4 as uuid } from "uuid";
import { broadcast } from "../eventBus.js";
import { PublicAnnouncementSchema } from "../schemas.js";
import { ChannelId, EventType } from "../types.js";
import { parseBody } from "../validate.js";

const router = Router();

// Public announcements publish: { guestName, message }
router.post("/", (req, res) => {
  const body = parseBody(PublicAnnouncementSchema, req, res);
  if (!body) return;

  const { guestName, message } = body;

  broadcast({
    id: uuid(),
    channel: ChannelId.Broadcast,
    event_type: EventType.PUBLIC_ANNOUNCEMENT,
    message,
    sender: guestName,
  });

  res.json({
    success: true,
  });
});

export default router;

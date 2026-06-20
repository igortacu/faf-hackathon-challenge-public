import { Router } from "express";
import { v4 as uuid } from "uuid";
import { broadcast } from "../eventBus.js";
import { ChannelId, EventType } from "../types.js";

const router = Router();

// Public announcements publish: { guestName, message }
router.post("/", (req, res) => {
  const { guestName, message } = req.body ?? {};

  broadcast({
    id: uuid(),
    channel: ChannelId.ResortWide,
    event_type: EventType.PUBLIC_ANNOUNCEMENT,
    message: message ?? "",
    sender: guestName ?? "guest",
    guest_name: guestName,
  });

  res.json({
    success: true,
  });
});

export default router;

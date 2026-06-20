import { Router } from "express";
import { v4 as uuid } from "uuid";
import { broadcast } from "../eventBus.js";
import { ChannelId, EventType } from "../types.js";

const router = Router();

router.post("/", (req, res) => {
  const { guestName, message } = req.body;

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
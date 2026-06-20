import { Router } from "express";
import { v4 as uuid } from "uuid";
import { broadcast } from "../eventBus.js";
import { ChannelId, EventType } from "../types.js";

const router = Router();

router.post("/full", (req, res) => {
  const { message, guest_id, guest_name, ...data } = req.body;

  broadcast({
    id: uuid(),
    channel: ChannelId.Beach,
    event_type: EventType.BEACH_FULL,
    message: message ?? "A beach activity reached capacity.",
    sender: "beach",
    guest_id,
    guest_name,
    data,
  });

  res.json({
    success: true,
  });
});

router.post("/available", (req, res) => {
  const { message, guest_id, guest_name, ...data } = req.body;

  broadcast({
    id: uuid(),
    channel: ChannelId.Beach,
    event_type: EventType.BEACH_FULL,
    message: message ?? "A beach activity has availability.",
    sender: "beach",
    guest_id,
    guest_name,
    data,
  });

  res.json({
    success: true,
  });
});

export default router;
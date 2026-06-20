import { Router } from "express";
import { v4 as uuid } from "uuid";
import { broadcast } from "../eventBus.js";
import { ChannelId, EventType } from "../types.js";

const router = Router();

// Beach may publish either { channel, message, sender, data } or { type, payload }.
function normalize(req: { body?: any }) {
  const { message, sender, data, payload } = req.body ?? {};
  const detail = data ?? payload ?? undefined;
  return {
    message: message ?? detail?.message ?? "",
    sender: sender ?? "beach",
    guest_id: detail?.guest_id,
    data: detail,
  };
}

router.post("/full", (req, res) => {
  const { message, sender, guest_id, data } = normalize(req);

  broadcast({
    id: uuid(),
    channel: ChannelId.Beach,
    event_type: EventType.BEACH_FULL,
    message,
    sender,
    guest_id,
    data,
  });

  res.json({
    success: true,
  });
});

router.post("/available", (req, res) => {
  const { message, sender, guest_id, data } = normalize(req);

  broadcast({
    id: uuid(),
    channel: ChannelId.Beach,
    event_type: EventType.BEACH_AVAILABLE,
    message,
    sender,
    guest_id,
    data,
  });

  res.json({
    success: true,
  });
});

export default router;

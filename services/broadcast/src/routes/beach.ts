import { Router } from "express";
import { v4 as uuid } from "uuid";
import { broadcast } from "../eventBus.js";
import { BeachEventSchema } from "../schemas.js";
import { ChannelId, EventType } from "../types.js";
import { parseBody } from "../validate.js";

const router = Router();

router.post("/full", (req, res) => {
  const body = parseBody(BeachEventSchema, req, res);
  if (!body) return;

  const { message, guest_id, guest_name, ...data } = body;

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
  const body = parseBody(BeachEventSchema, req, res);
  if (!body) return;

  const { message, guest_id, guest_name, ...data } = body;

  broadcast({
    id: uuid(),
    channel: ChannelId.Beach,
    event_type: EventType.BEACH_AVAILABLE,
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

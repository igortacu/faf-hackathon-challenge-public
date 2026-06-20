import { Router } from "express";
import { v4 as uuid } from "uuid";
import { broadcast } from "../eventBus.js";
import { CursedEventSchema } from "../schemas.js";
import { ChannelId, EventType } from "../types.js";
import { parseBody } from "../validate.js";

const router = Router();

// Parrot publishes: { guest_id, message, triggered_word } when a guest's
// chat message is flagged by the profanity filter.
router.post("/", (req, res) => {
  const body = parseBody(CursedEventSchema, req, res);
  if (!body) return;

  const { guest_id, message, triggered_word } = body;

  broadcast({
    id: uuid(),
    channel: ChannelId.Parrot,
    event_type: EventType.PARROT_CURSED,
    message,
    sender: "parrot",
    guest_id,
    data: { triggered_word },
  });

  res.json({
    success: true,
  });
});

export default router;

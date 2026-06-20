import { Router } from "express";
import { v4 as uuid } from "uuid";
import { broadcast } from "../eventBus.js";
import { HotelEventSchema } from "../schemas.js";
import { ChannelId, EventType } from "../types.js";
import { parseBody } from "../validate.js";


const router = Router();

// Hotel publishes: { message, guest_id, guest_name, reservation_id, room_type, ... }
router.post("/confirm", (req, res) => {
  const body = parseBody(HotelEventSchema, req, res);
  if (!body) return;

  const { message, guest_id, guest_name, ...data } = body;

  broadcast({
    id: uuid(),
    channel: ChannelId.Hotel,
    event_type: EventType.HOTEL_CONFIRM,
    message: message ?? "A reservation was confirmed.",
    sender: "hotel",
    guest_id,
    guest_name,
    data,
  });

  res.json({
    success: true,
  });
});

router.post("/cancel", (req, res) => {
  const body = parseBody(HotelEventSchema, req, res);
  if (!body) return;

  const { message, guest_id, guest_name, ...data } = body;

  broadcast({
    id: uuid(),
    channel: ChannelId.Hotel,
    event_type: EventType.HOTEL_CANCEL,
    message: message ?? "A reservation was cancelled.",
    sender: "hotel",
    guest_id,
    guest_name,
    data,
  });

  res.json({
    success: true,
  });
});

export default router;

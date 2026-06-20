import { Router } from "express";
import { v4 as uuid } from "uuid";
import { broadcast } from "../eventBus.js";
import { ChannelId, EventType } from "../types.js";


const router = Router();

// Hotel publishes: { type, payload: { message, reservation_id, guest_id, ... } }
router.post("/confirm", (req, res) => {
  const { message, guest_id, guest_name, ...data } = req.body;

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
  const { message, guest_id, guest_name, ...data } = req.body;

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

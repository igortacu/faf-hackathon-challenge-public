import { Router } from "express";
import { v4 as uuid } from "uuid";
import { broadcast } from "../eventBus.js";
import { ChannelId, EventType } from "../types.js";

const router = Router();

router.post("/order", (req, res) => {
  const { message, guest_id, guest_name, ...data } = req.body;

  broadcast({
    id: uuid(),
    channel: ChannelId.Crab,
    event_type: EventType.CRAB_ORDER_PLACED,
    message: message ?? "A guest ordered at the Crusty Crab.",
    sender: "crab",
    guest_id,
    guest_name,
    data,
  });

  res.json({ success: true });
});

router.post("/sold-out", (req, res) => {
  const { message, guest_id, guest_name, ...data } = req.body;

  broadcast({
    id: uuid(),
    channel: ChannelId.Crab,
    event_type: EventType.CRAB_SOLD_OUT,
    message: message ?? "An item sold out at the Crusty Crab.",
    sender: "crab",
    guest_id,
    guest_name,
    data,
  });

  res.json({ success: true });
});

export default router;

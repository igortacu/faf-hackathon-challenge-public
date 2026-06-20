import { Router } from "express";
import { v4 as uuid } from "uuid";
import { broadcast } from "../eventBus.js";
import { ChannelId, EventType } from "../types.js";

const router = Router();

// Airport publishes: { channel, message, sender, data: { guest_id, name, surname, ... } }
router.post("/arrival", (req, res) => {
  const { message, guest_id, guest_name, ...data } = req.body;

  broadcast({
    id: uuid(),
    channel: ChannelId.Airport,
    event_type: EventType.AIRPORT_ARRIVAL,
    message: message ?? "A guest arrived at the airport.",
    sender: "airport",
    guest_id,
    guest_name,
    data,
  });

  res.json({
    success: true,
  });
});

export default router;

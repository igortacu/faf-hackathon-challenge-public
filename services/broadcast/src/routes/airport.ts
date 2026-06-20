import { Router } from "express";
import { v4 as uuid } from "uuid";
import { broadcast } from "../eventBus.js";
import { ChannelId, EventType } from "../types.js";

const router = Router();

// Airport publishes: { channel, message, sender, data: { guest_id, name, surname, ... } }
router.post("/arrival", (req, res) => {
  const { message, sender, data } = req.body ?? {};

  const guestName = data
    ? `${data.name ?? ""} ${data.surname ?? ""}`.trim() || undefined
    : undefined;

  broadcast({
    id: uuid(),
    channel: ChannelId.Airport,
    event_type: EventType.AIRPORT_ARRIVAL,
    message: message ?? "",
    sender: sender ?? "airport",
    guest_id: data?.guest_id,
    guest_name: guestName,
    data,
  });

  res.json({
    success: true,
  });
});

export default router;

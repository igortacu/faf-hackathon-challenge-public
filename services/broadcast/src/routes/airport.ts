import { Router } from "express";
import { v4 as uuid } from "uuid";
import { broadcast } from "../eventBus.js";
import { AirportArrivalSchema } from "../schemas.js";
import { ChannelId, EventType } from "../types.js";
import { parseBody } from "../validate.js";

const router = Router();

// Airport publishes: { message, guest_id, guest_name, gate, passport_type }
router.post("/arrival", (req, res) => {
  const body = parseBody(AirportArrivalSchema, req, res);
  if (!body) return;

  const { message, guest_id, guest_name, ...data } = body;

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

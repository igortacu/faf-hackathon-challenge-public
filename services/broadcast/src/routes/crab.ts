import { Router } from "express";
import { v4 as uuid } from "uuid";
import { broadcast } from "../eventBus.js";
import { CrabOrderSchema, CrabSoldOutSchema } from "../schemas.js";
import { ChannelId, EventType } from "../types.js";
import { parseBody } from "../validate.js";

const router = Router();

router.post("/order", (req, res) => {
  const body = parseBody(CrabOrderSchema, req, res);
  if (!body) return;

  const { message, guest_id, guest_name, ...data } = body;

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
  const body = parseBody(CrabSoldOutSchema, req, res);
  if (!body) return;

  const { message, guest_id, guest_name, ...data } = body;

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

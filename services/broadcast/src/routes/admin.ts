import { Router } from "express";
import { v4 as uuid } from "uuid";
import { requireAdmin } from "../adminAuth.js";
import { broadcast } from "../eventBus.js";
import { ChannelId, EventType } from "../types.js";

const router = Router();

router.post("/announcement", requireAdmin, (req, res) => {
  const { message, sender } = req.body;

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  broadcast({
    id: uuid(),
    channel: ChannelId.ResortWide,
    event_type: EventType.ADMIN_ANNOUNCEMENT,
    message,
    sender: typeof sender === "string" && sender ? sender : "Admin",
  });

  res.json({
    success: true,
  });
});

export default router;

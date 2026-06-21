import { Router } from "express";
import { addClient, removeClient } from "../eventBus.js";
import { identifyService } from "../serviceAuth.js";

const router = Router();

router.get("/", (req, res) => {
  // Fails closed: an unrecognized or missing token gets no stream at all,
  // rather than defaulting to full access.
  const identity = identifyService(req);
  if (!identity) {
    res.status(401).json({ error: "Service authentication required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  addClient(res, identity.allowedChannels);

  req.on("close", () => {
    removeClient(res);
  });
});

export default router;
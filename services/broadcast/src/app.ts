import express, { Express } from "express";

import airportRoutes from "./routes/airport.js";
import hotelRoutes from "./routes/hotel.js";
import beachRoutes from "./routes/beach.js";
import crabRoutes from "./routes/crab.js";
import cursedRoutes from "./routes/cursed.js";
import publicRoutes from "./routes/public.js";
import adminRoutes from "./routes/admin.js";
import eventRoutes from "./routes/events.js";

// Builds the Express app with all routes wired. Kept separate from server.ts
// so tests can mount the app without binding a fixed port.
export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "healthy" });
  });

  app.use("/events/", eventRoutes);
  app.use("/airport/", airportRoutes);
  app.use("/hotel/", hotelRoutes);
  app.use("/beach/", beachRoutes);
  app.use("/crab/", crabRoutes);
  app.use("/cursed/", cursedRoutes);
  app.use("/public/", publicRoutes);
  app.use("/admin/", adminRoutes);

  return app;
}

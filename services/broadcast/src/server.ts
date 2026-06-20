import dotenv from "dotenv";


import airportRoutes from "./routes/airport.js";
import hotelRoutes from "./routes/hotel.js";
import beachRoutes from "./routes/beach.js";
import publicRoutes from "./routes/public.js";
import adminRoutes from "./routes/admin.js";
import eventRoutes from "./routes/events.js";

dotenv.config();

const app = createApp();

const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "healthy" });
});

app.use("/events/", eventRoutes);
app.use("/airport/", airportRoutes);
app.use("/hotel/", hotelRoutes);
app.use("/beach/", beachRoutes);
app.use("/public/", publicRoutes);
app.use("/admin/", adminRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

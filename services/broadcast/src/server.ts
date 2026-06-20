import dotenv from "dotenv";

import { createApp } from "./app.js";

dotenv.config();

const app = createApp();

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

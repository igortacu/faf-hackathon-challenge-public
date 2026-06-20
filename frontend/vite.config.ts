import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Allow any Host (public domain / grader) for both dev and preview.
  // The container runs `vite preview`, which reads `preview.allowedHosts`
  // (NOT `server.allowedHosts`), so both must be set.
  server: {
    allowedHosts: true,
  },
  preview: {
    allowedHosts: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

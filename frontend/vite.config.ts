import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The dev server forwards every /api request to the FastAPI backend on port 8000,
// so the browser only ever talks to one address (no CORS setup needed).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { "/api": "http://localhost:8000" },
  },
});

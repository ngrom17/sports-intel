import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },

  server: {
    port: 5173,
    host: true,        // bind 0.0.0.0 so iPad / LAN access works
    proxy: {
      // In dev, /api/* is proxied to the local FastAPI backend
      "/api": {
        target:      "http://localhost:8090",
        changeOrigin: true,
      },
    },
  },

  preview: {
    port: 5173,
    host: true,
  },
});

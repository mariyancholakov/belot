import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: { "/ws": { target: "ws://localhost:3000", ws: true } },
  },
  // the spoken calls stay separate files, fetched after the page loads, instead of growing the bundle
  build: { outDir: "dist", assetsInlineLimit: (file) => (file.endsWith(".mp3") ? false : undefined) },
});

import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    // Keeps the API same-origin in dev, so no CORS config is needed on the Nest side.
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET ?? `http://localhost:${process.env.PORT ?? 3000}`,
        changeOrigin: true,
      },
    },
    // Bind mounts do not deliver fs events reliably, so the container watches by polling.
    watch: process.env.VITE_USE_POLLING ? { usePolling: true, interval: 300 } : undefined,
  },
});

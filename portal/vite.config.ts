import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Built into portal/dist and served by the Hukam router (src/bus.mjs) at http://localhost:4747.
// `npm run dev` proxies the API and event stream to a running router.
const router = "http://127.0.0.1:4747";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 900 },
  server: {
    port: 5174,
    proxy: {
      "/api": { target: router, headers: { host: "localhost:4747", origin: "http://localhost:4747" } },
      "/events": { target: router, headers: { host: "localhost:4747" } },
      "/config": { target: router, headers: { host: "localhost:4747" } },
      "/inbox": { target: router, headers: { host: "localhost:4747" } },
      "/outputs": { target: router, headers: { host: "localhost:4747" } },
      "/files": { target: router, headers: { host: "localhost:4747" } },
    },
  },
});

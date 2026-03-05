import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const proxyTarget = "http://127.0.0.1:8080";
// Visual harness runs the UI without a backend; disable proxy so SPA routes like /admin/users
// are served by Vite (fixtures intercept fetch instead).
const disableProxy = process.env.VITE_DISABLE_PROXY === "1" || process.env.VISUAL_FIXTURES === "1";

const proxy = disableProxy
  ? undefined
  : {
      "/health": proxyTarget,
      "^/setup/status$": proxyTarget,
      "^/setup/admin$": proxyTarget,
      "/auth": proxyTarget,
      "/admin": proxyTarget,
      "/nodes": proxyTarget,
      "/jobs": proxyTarget,
      "/trash": proxyTarget,
      "/search": proxyTarget,
      "/media": proxyTarget,
      "^/s/": proxyTarget,
      "/system": proxyTarget
    };


export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 13000,
    allowedHosts: true,
    proxy,
  }
});

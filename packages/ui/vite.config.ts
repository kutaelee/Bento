import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage } from "node:http";

const proxyTarget = "http://127.0.0.1:8080";
// Visual harness runs the UI without a backend; disable proxy so SPA routes like /admin/users
// are served by Vite (fixtures intercept fetch instead).
const disableProxy = process.env.VITE_DISABLE_PROXY === "1" || process.env.VISUAL_FIXTURES === "1";

const shouldBypassForSpaNavigation = (req: IncomingMessage) => {
  const accept = req.headers.accept;
  return typeof accept === "string" && accept.includes("text/html");
};

const proxy = disableProxy
  ? undefined
  : {
      "/health": proxyTarget,
      "^/setup/status$": proxyTarget,
      "^/setup/admin$": proxyTarget,
      "/auth": proxyTarget,
      "/admin": {
        target: proxyTarget,
        bypass: (req) => (shouldBypassForSpaNavigation(req) ? req.url : undefined),
      },
      "/nodes": proxyTarget,
      "/jobs": proxyTarget,
      "/trash": {
        target: proxyTarget,
        bypass: (req) => (shouldBypassForSpaNavigation(req) ? req.url : undefined),
      },
      "/search": {
        target: proxyTarget,
        bypass: (req) => (shouldBypassForSpaNavigation(req) ? req.url : undefined),
      },
      "/media": {
        target: proxyTarget,
        bypass: (req) => (shouldBypassForSpaNavigation(req) ? req.url : undefined),
      },
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

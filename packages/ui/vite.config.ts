import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const proxyTarget = process.env.VITE_PROXY_TARGET ?? "http://127.0.0.1:18080";
const configDir = path.dirname(fileURLToPath(import.meta.url));
// Visual harness runs the UI without a backend; disable proxy so SPA routes like /admin/users
// are served by Vite (fixtures intercept fetch instead).
const disableProxy = process.env.VITE_DISABLE_PROXY === "1" || process.env.VISUAL_FIXTURES === "1";

const shouldBypassForSpaNavigation = (req: IncomingMessage) => {
  const accept = req.headers.accept;
  return typeof accept === "string" && accept.includes("text/html");
};

const spaFallback = (req: IncomingMessage) => (shouldBypassForSpaNavigation(req) ? "/index.html" : undefined);

const spaDocumentRoutes = [
  /^\/$/,
  /^\/login(?:\/|$)/,
  /^\/setup(?:\/|$)/,
  /^\/invite\/accept(?:\/|$)/,
  /^\/files(?:\/|$)/,
  /^\/recent(?:\/|$)/,
  /^\/favorites(?:\/|$)/,
  /^\/shared(?:\/|$)/,
  /^\/search(?:\/|$)/,
  /^\/media(?:\/|$)/,
  /^\/trash(?:\/|$)/,
  /^\/admin(?:\/|$)/,
];

const shouldServeSpaDocument = (req: IncomingMessage) => {
  if (req.method !== "GET" || !shouldBypassForSpaNavigation(req) || typeof req.url !== "string") {
    return false;
  }
  const pathname = req.url.split("?")[0] ?? "/";
  return spaDocumentRoutes.some((route) => route.test(pathname));
};

const spaDocumentFallback = () => ({
  name: "spa-document-fallback",
  configureServer(server: import("vite").ViteDevServer) {
    const indexHtmlPath = path.resolve(configDir, "index.html");
    server.middlewares.use(async (req, res, next) => {
      if (!shouldServeSpaDocument(req)) {
        next();
        return;
      }

      try {
        const rawHtml = await readFile(indexHtmlPath, "utf8");
        const html = await server.transformIndexHtml(req.url ?? "/", rawHtml);
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(html);
      } catch (error) {
        next(error as Error);
      }
    });
  },
});

const proxy = disableProxy
  ? undefined
  : {
      "/health": proxyTarget,
      "^/setup/status$": proxyTarget,
      "^/setup/admin$": proxyTarget,
      "/auth": proxyTarget,
      "/me": proxyTarget,
      "/admin/users": proxyTarget,
      "/admin/invites": proxyTarget,
      "/admin/system-mode": proxyTarget,
      "/admin/migrations": proxyTarget,
      "/admin/storage/scan": proxyTarget,
      "/admin/volumes": proxyTarget,
      "/admin": {
        target: proxyTarget,
        bypass: spaFallback,
      },
      "/nodes": proxyTarget,
      "/uploads": proxyTarget,
      "/jobs": proxyTarget,
      "/trash": {
        target: proxyTarget,
        bypass: spaFallback,
      },
      "/search": {
        target: proxyTarget,
        bypass: spaFallback,
      },
      "/media": {
        target: proxyTarget,
        bypass: spaFallback,
      },
      "^/s/": proxyTarget,
      "/system": proxyTarget
    };


export default defineConfig({
  plugins: [react(), spaDocumentFallback()],
  server: {
    host: "0.0.0.0",
    port: 13000,
    allowedHosts: true,
    proxy,
  }
});

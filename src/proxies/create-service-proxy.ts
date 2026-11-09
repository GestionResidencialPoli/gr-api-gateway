import { createProxyMiddleware } from "http-proxy-middleware";
import type { IncomingMessage, Server as HttpServer } from "http";
import type { Socket } from "net";
import type { ServiceRoute } from "../routes/service-registry";
import Logger from "../lib/logger";

function splitSetCookieHeaders(setCookies: string | string[]): string[] {
  const headers = Array.isArray(setCookies) ? setCookies : [setCookies];

  return headers.flatMap((header) => header.split(/,\s*(?=[^;,\s=]+=[^;,]+)/));
}

function createServiceProxy(service: ServiceRoute, ws = false) {
  return createProxyMiddleware({
    target: service.target,
    changeOrigin: true,
    ws,
    pathFilter: service.pathPrefixes,
    on: {
      proxyRes: (proxyRes) => {
        const setCookies = proxyRes.headers["set-cookie"];

        if (setCookies) {
          proxyRes.headers["set-cookie"] = splitSetCookieHeaders(setCookies);
        }
      },
      error: (error, _req, res) => {
        Logger.error(error as Error, { service: service.name });

        if ("writeHead" in res && !res.headersSent) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { message: "El servicio no esta disponible en este momento." } }));
        }
      },
    },
  });
}

export function attachWebSocketProxy(server: HttpServer, service: ServiceRoute, path: string): void {
  const proxy = createServiceProxy(service, true);

  server.on("upgrade", (req: IncomingMessage, socket: Socket, head: Buffer) => {
    const requestPath = new URL(req.url ?? "/", "http://localhost").pathname;
    if (requestPath !== path) return;
    proxy.upgrade(req, socket, head);
  });
}

export default createServiceProxy;

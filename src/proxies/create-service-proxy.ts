import { createProxyMiddleware } from "http-proxy-middleware";
import type { ServiceRoute } from "../routes/service-registry";
import Logger from "../lib/logger";

function createServiceProxy(service: ServiceRoute) {
  return createProxyMiddleware({
    target: service.target,
    changeOrigin: true,
    pathFilter: service.pathPrefixes,
    on: {
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

export default createServiceProxy;

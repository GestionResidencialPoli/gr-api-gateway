import { Router } from "express";
import authenticate from "../middlewares/authenticate";
import requireAuthentication from "../middlewares/require-authentication";
import { authRateLimiter } from "../middlewares/rate-limiter";
import createServiceProxy from "../proxies/create-service-proxy";
import serviceRegistry, { type ServiceRoute } from "./service-registry";

function isPublicPath(service: ServiceRoute, path: string): boolean {
  return service.publicPaths.some((publicPath) => path === publicPath || path.startsWith(`${publicPath}/`));
}

function gatewayRouter(): Router {
  const router = Router();

  router.use(authenticate);
  router.use("/api/v1/auth", authRateLimiter);

  serviceRegistry.forEach((service) => {
    const proxy = createServiceProxy(service);

    service.pathPrefixes.forEach((pathPrefix) => {
      router.use(pathPrefix, (req, res, next) => {
        const path = req.originalUrl.split("?")[0] ?? req.path;

        if (isPublicPath(service, path)) {
          next();
          return;
        }

        requireAuthentication(req, res, next);
      });

      router.use(pathPrefix, proxy);
    });
  });

  return router;
}

export default gatewayRouter;

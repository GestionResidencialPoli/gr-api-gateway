import { Router, type Request, type NextFunction, type Response } from "express";
import authenticate from "../middlewares/authenticate";
import requireAuthentication from "../middlewares/require-authentication";
import { authRateLimiter } from "../middlewares/rate-limiter";
import createServiceProxy from "../proxies/create-service-proxy";
import serviceRegistry, { type ServiceRoute } from "./service-registry";

function matchesService(service: ServiceRoute, path: string): boolean {
  return service.pathPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function isPublicPath(service: ServiceRoute, path: string, method: string): boolean {
  return service.publicPaths.some((publicPath) => {
    if (typeof publicPath === "string") {
      return path === publicPath || path.startsWith(`${publicPath}/`);
    }
    return publicPath.method === method && path === publicPath.path;
  });
}

function gatewayRouter(): Router {
  const router = Router();

  router.use(authenticate);
  router.use("/api/v1/auth", authRateLimiter);

  serviceRegistry.forEach((service) => {
    router.use((req: Request, res: Response, next: NextFunction) => {
      const path = req.originalUrl.split("?")[0] ?? req.path;

      if (!matchesService(service, path) || isPublicPath(service, path, req.method)) {
        next();
        return;
      }

      requireAuthentication(req, res, next);
    });

    router.use(createServiceProxy(service));
  });

  return router;
}

export default gatewayRouter;

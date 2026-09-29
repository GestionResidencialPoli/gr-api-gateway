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

const AUTH_THROTTLED_PATHS = [
  "/api/v1/auth/login",
  "/api/v1/auth/password-reset",
  "/api/v1/auth/password-reset/confirm",
];

function isAuthThrottledPath(path: string): boolean {
  return AUTH_THROTTLED_PATHS.some((authPath) => path === authPath || path.startsWith(`${authPath}/`));
}

function gatewayRouter(): Router {
  const router = Router();

  router.use(authenticate);
  router.use((req: Request, res: Response, next: NextFunction) => {
    const path = req.originalUrl.split("?")[0] ?? req.path;

    if (req.method === "POST" && isAuthThrottledPath(path)) {
      authRateLimiter(req, res, next);
      return;
    }

    next();
  });

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

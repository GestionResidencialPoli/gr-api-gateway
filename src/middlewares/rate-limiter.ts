import rateLimit from "express-rate-limit";
import type { Request } from "express";
import config from "../config";
import HybridRateLimitStore from "./rate-limit-store";

/**
 * These endpoints either require an already authenticated session or are
 * infrastructure for the session itself.  Counting them against the login
 * limiter makes a normal multi-frontend navigation consume the whole budget
 * (React StrictMode also performs the initial session check twice in dev).
 * Credential-changing endpoints remain protected by authRateLimiter below.
 */
const SESSION_AUTH_REQUESTS = new Set([
  "GET /csrf",
  "GET /me",
  "POST /refresh",
  "POST /logout",
  "POST /sso/code",
  "POST /sso/exchange",
]);

export function shouldSkipAuthRateLimit(request: Pick<Request, "method" | "path">): boolean {
  return SESSION_AUTH_REQUESTS.has(`${request.method.toUpperCase()} ${request.path}`);
}

export const globalRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Demasiadas solicitudes, intenta de nuevo mas tarde." } },
  store: new HybridRateLimitStore("rl:global:"),
});

export const authRateLimiter = rateLimit({
  windowMs: config.authRateLimit.windowMs,
  limit: config.authRateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Demasiados intentos de autenticacion, intenta de nuevo mas tarde." } },
  store: new HybridRateLimitStore("rl:auth:"),
  skip: shouldSkipAuthRateLimit,
});

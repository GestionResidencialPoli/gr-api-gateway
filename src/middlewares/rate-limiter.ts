import rateLimit from "express-rate-limit";
import config from "../config";

export const globalRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Demasiadas solicitudes, intenta de nuevo mas tarde." } },
});

export const authRateLimiter = rateLimit({
  windowMs: config.authRateLimit.windowMs,
  limit: config.authRateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Demasiados intentos de autenticacion, intenta de nuevo mas tarde." } },
});

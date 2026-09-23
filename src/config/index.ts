import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }

  return value;
}

function requiredList(name: string, fallback: string): string[] {
  const value = process.env[name] ?? fallback;
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const jwtSecret = required("JWT_SECRET");

if (jwtSecret.length < 32) {
  throw new Error(
    "JWT_SECRET debe tener al menos 32 caracteres: debe coincidir con el mismo secreto HMAC-SHA256 del user-microservice",
  );
}

const config = {
  env: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  jwtSecret,
  accessTokenCookieName: process.env.ACCESS_TOKEN_COOKIE_NAME ?? "access_token",
  corsAllowedOrigins: requiredList("CORS_ALLOWED_ORIGINS", "http://localhost:3000"),
  userServiceUrl: process.env.USER_SERVICE_URL ?? "http://localhost:8080",
  wallServiceUrl: process.env.WALL_SERVICE_URL ?? "http://localhost:4100",
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
    max: Number(process.env.RATE_LIMIT_MAX ?? 300),
  },
  authRateLimit: {
    windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? 60_000),
    max: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10),
  },
  redis: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  },
} as const;

export default config;

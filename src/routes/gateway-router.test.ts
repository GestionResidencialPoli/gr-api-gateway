import { describe, expect, it, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import jwt from "jsonwebtoken";
import config from "../config";

vi.mock("../middlewares/rate-limiter", () => ({
  authRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../proxies/create-service-proxy", () => ({
  default: () => (req: express.Request, res: express.Response) => res.status(200).json({ proxied: true, path: req.originalUrl }),
}));

import gatewayRouter from "./gateway-router";

function buildApp() {
  const app = express();
  app.use(cookieParser());
  app.use(gatewayRouter());
  return app;
}

function signToken(roles: string[] = ["RESIDENTE"]) {
  return jwt.sign({ sub: "1", uid: 1, roles }, config.jwtSecret, { algorithm: "HS256" });
}

describe("gatewayRouter", () => {
  it("permite una ruta publica sin cookie de sesion", async () => {
    const res = await request(buildApp()).get("/api/v1/auth/login");
    expect(res.status).toBe(200);
  });

  it("rechaza una ruta protegida sin autenticacion", async () => {
    const res = await request(buildApp()).get("/api/v1/apartamentos");
    expect(res.status).toBe(401);
  });

  it("rechaza una ruta protegida con una cookie de sesion invalida", async () => {
    const res = await request(buildApp()).get("/api/v1/apartamentos").set("Cookie", "access_token=basura");
    expect(res.status).toBe(401);
  });

  it("permite una ruta protegida con un JWT valido", async () => {
    const res = await request(buildApp()).get("/api/v1/apartamentos").set("Cookie", `access_token=${signToken()}`);
    expect(res.status).toBe(200);
  });

  it("enruta al servicio del muro conservando el path completo (sin el bug de path-stripping)", async () => {
    const res = await request(buildApp())
      .get("/api/v1/publicaciones/42")
      .set("Cookie", `access_token=${signToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.path).toBe("/api/v1/publicaciones/42");
  });
});

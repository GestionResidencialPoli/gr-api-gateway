import { describe, expect, it, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import jwt from "jsonwebtoken";
import config from "../config";

vi.mock("../middlewares/rate-limiter", () => ({
  authRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  contactRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../proxies/create-service-proxy", () => ({
  default:
    (service: { name: string; pathPrefixes: string[] }) =>
    (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const path = req.originalUrl.split("?")[0] ?? "";
      if (!service.pathPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
        next();
        return;
      }
      res.status(200).json({ proxied: true, path: req.originalUrl, service: service.name });
    },
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

  it("deja pasar el canje SSO sin cookie de sesion: la app destino todavia no tiene una", async () => {
    const res = await request(buildApp()).post("/api/v1/auth/sso/exchange");
    expect(res.status).toBe(200);
  });

  it("exige sesion para emitir un codigo SSO", async () => {
    const res = await request(buildApp()).post("/api/v1/auth/sso/code");
    expect(res.status).toBe(401);
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

  it.each([
    ["/api/v1/zonas-comunes/3/disponibilidad?desde=2026-10-01", "booking-microservice"],
    ["/api/v1/reservas/mias", "booking-microservice"],
    ["/api/v1/porteria/visitas/abiertas", "gate-microservice"],
    ["/api/v1/porteria/eventos", "gate-microservice"],
  ])("enruta %s a %s conservando la ruta completa", async (ruta, servicio) => {
    const res = await request(buildApp()).get(ruta).set("Cookie", `access_token=${signToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ service: servicio, path: ruta });
  });

  it("exige sesion para reservas y porteria", async () => {
    expect((await request(buildApp()).get("/api/v1/reservas/mias")).status).toBe(401);
    expect((await request(buildApp()).get("/api/v1/porteria/aforo")).status).toBe(401);
  });

  it("permite solo POST en la ruta pública exacta de contacto", async () => {
    expect((await request(buildApp()).post("/api/v1/contacto/solicitudes")).status).toBe(200);
    expect((await request(buildApp()).post("/api/v1/contacto/solicitudes?origen=web")).status).toBe(200);
    expect((await request(buildApp()).get("/api/v1/contacto/solicitudes")).status).toBe(401);
    expect((await request(buildApp()).post("/api/v1/contacto/solicitudes/")).status).toBe(401);
    expect((await request(buildApp()).post("/api/v1/contacto/solicitudes/1")).status).toBe(401);
  });

  it("protege toda la ruta financiera y conserva el path", async () => {
    expect((await request(buildApp()).get("/api/v1/finanzas/cartera")).status).toBe(401);
    const res = await request(buildApp()).post("/api/v1/finanzas/graphql").set("Cookie", `access_token=${signToken(["ADMINISTRACION"])}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ service: "billing-microservice", path: "/api/v1/finanzas/graphql" });
  });
});

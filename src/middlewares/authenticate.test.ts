import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import config from "../config";
import authenticate from "./authenticate";

function mockRequest(cookies: Record<string, string> = {}): Request {
  return { cookies } as unknown as Request;
}

describe("authenticate", () => {
  it("deja req.auth en null y llama a next si no hay cookie de sesion", () => {
    const req = mockRequest();
    const next = vi.fn();

    authenticate(req, {} as Response, next);

    expect(req.auth).toBeNull();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("deja req.auth en null y llama a next si el token es invalido", () => {
    const req = mockRequest({ access_token: "basura" });
    const next = vi.fn();

    authenticate(req, {} as Response, next);

    expect(req.auth).toBeNull();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("puebla req.auth con los claims cuando el token es valido, y llama a next", () => {
    const token = jwt.sign({ sub: "1", uid: 1, roles: ["ADMINISTRACION"] }, config.jwtSecret, { algorithm: "HS256" });
    const req = mockRequest({ access_token: token });
    const next = vi.fn();

    authenticate(req, {} as Response, next);

    expect(req.auth).toEqual({ sub: "1", uid: 1, roles: ["ADMINISTRACION"], tipoResidente: undefined });
    expect(next).toHaveBeenCalledTimes(1);
  });
});

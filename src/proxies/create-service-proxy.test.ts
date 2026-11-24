import http, { type Server as HttpServer } from "http";
import type { AddressInfo } from "net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attachWebSocketProxy } from "./create-service-proxy";

const PATH = "/api/v1/notificaciones/ws";

let target: HttpServer;
let gateway: HttpServer;
let received: string[];

function listen(server: HttpServer): Promise<number> {
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve((server.address() as AddressInfo).port)),
  );
}

function upgrade(port: number, path: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    const request = http.request({
      port,
      host: "127.0.0.1",
      path,
      headers: { Connection: "Upgrade", Upgrade: "websocket", Cookie: "access_token=abc" },
      timeout: 500,
    });
    request.once("upgrade", (response, socket) => {
      socket.destroy();
      resolve(response.statusCode);
    });
    request.once("timeout", () => request.destroy());
    request.once("error", () => resolve(undefined));
    request.end();
  });
}

describe("attachWebSocketProxy", () => {
  beforeEach(async () => {
    received = [];
    target = http.createServer();
    target.on("upgrade", (request, socket) => {
      received.push(`${request.url} ${request.headers.cookie}`);
      socket.end("HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n");
    });
    const port = await listen(target);
    gateway = http.createServer();
    attachWebSocketProxy(
      gateway,
      {
        name: "notification-microservice",
        pathPrefixes: ["/api/v1/notificaciones"],
        target: `http://127.0.0.1:${port}`,
        publicPaths: [],
      },
      PATH,
    );
  });

  afterEach(() => {
    target.close();
    gateway.close();
  });

  it("reenvia la conexion con la cookie de sesion", async () => {
    expect(await upgrade(await listen(gateway), PATH)).toBe(101);
    expect(received).toEqual([`${PATH} access_token=abc`]);
  });

  it("no expone la ruta interna entre microservicios", async () => {
    expect(await upgrade(await listen(gateway), "/internal/ws")).toBeUndefined();
    expect(received).toEqual([]);
  });
});

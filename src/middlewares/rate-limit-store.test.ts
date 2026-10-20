import { describe, expect, it, vi, beforeEach } from "vitest";
import HybridRateLimitStore from "./rate-limit-store";

const { redisIncrement, redisDecrement, redisResetKey, memoryIncrement, memoryDecrement, memoryResetKey } = vi.hoisted(() => ({
  redisIncrement: vi.fn(),
  redisDecrement: vi.fn(),
  redisResetKey: vi.fn(),
  memoryIncrement: vi.fn(),
  memoryDecrement: vi.fn(),
  memoryResetKey: vi.fn(),
}));

vi.mock("../lib/redis-client", () => ({ default: { call: vi.fn() } }));

vi.mock("rate-limit-redis", () => ({
  RedisStore: vi.fn().mockImplementation(function RedisStore() {
    return { increment: redisIncrement, decrement: redisDecrement, resetKey: redisResetKey };
  }),
}));

vi.mock("express-rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("express-rate-limit")>();
  return {
    ...actual,
    MemoryStore: vi.fn().mockImplementation(function MemoryStore() {
      return { increment: memoryIncrement, decrement: memoryDecrement, resetKey: memoryResetKey };
    }),
  };
});

describe("HybridRateLimitStore", () => {
  beforeEach(() => {
    redisIncrement.mockReset();
    redisDecrement.mockReset();
    redisResetKey.mockReset();
    memoryIncrement.mockReset();
    memoryDecrement.mockReset();
    memoryResetKey.mockReset();
  });

  it("incrementa usando Redis cuando esta disponible", async () => {
    redisIncrement.mockResolvedValue({ totalHits: 1, resetTime: undefined });
    const store = new HybridRateLimitStore("rl:test:");

    const result = await store.increment("1.2.3.4");

    expect(result).toEqual({ totalHits: 1, resetTime: undefined });
    expect(redisIncrement).toHaveBeenCalledWith("1.2.3.4");
    expect(memoryIncrement).not.toHaveBeenCalled();
  });

  it("cae al store en memoria si Redis falla al incrementar", async () => {
    redisIncrement.mockRejectedValue(new Error("connection refused"));
    memoryIncrement.mockResolvedValue({ totalHits: 1, resetTime: undefined });
    const store = new HybridRateLimitStore("rl:test:");

    const result = await store.increment("1.2.3.4");

    expect(result).toEqual({ totalHits: 1, resetTime: undefined });
    expect(memoryIncrement).toHaveBeenCalledWith("1.2.3.4");
  });

  it("decrementa en ambos stores sin lanzar si Redis falla", async () => {
    redisDecrement.mockRejectedValue(new Error("connection refused"));
    memoryDecrement.mockResolvedValue(undefined);
    const store = new HybridRateLimitStore("rl:test:");

    await expect(store.decrement("1.2.3.4")).resolves.toBeUndefined();
    expect(memoryDecrement).toHaveBeenCalledWith("1.2.3.4");
  });

  it("resetea la clave en ambos stores sin lanzar si uno de los dos falla", async () => {
    redisResetKey.mockResolvedValue(undefined);
    memoryResetKey.mockRejectedValue(new Error("no deberia importar"));
    const store = new HybridRateLimitStore("rl:test:");

    await expect(store.resetKey("1.2.3.4")).resolves.toBeUndefined();
  });
});

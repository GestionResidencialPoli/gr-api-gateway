import { MemoryStore, type Store, type Options, type IncrementResponse } from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import redis from "../lib/redis-client";
import Logger from "../lib/logger";

/**
 * Store hibrido para express-rate-limit: usa Redis como contador compartido entre
 * replicas del gateway (necesario porque k3s puede levantar mas de un pod por
 * trafico, y un contador en memoria por proceso no serviria de limite real) y cae
 * a un store en memoria del propio proceso si Redis no responde, para que Redis no
 * se vuelva un punto unico de falla del gateway completo.
 */
class HybridRateLimitStore implements Store {
  private readonly redisStore: RedisStore;

  private readonly memoryStore: MemoryStore;

  constructor(prefix: string) {
    this.redisStore = new RedisStore({
      sendCommand: (...args: string[]) => {
        const [command, ...rest] = args;
        return redis.call(command as string, rest) as Promise<RedisReply>;
      },
      prefix,
    });
    this.memoryStore = new MemoryStore();
  }

  public init(options: Options): void {
    this.redisStore.init?.(options);
    this.memoryStore.init?.(options);
  }

  public async increment(key: string): Promise<IncrementResponse> {
    try {
      return await this.redisStore.increment(key);
    } catch (error) {
      Logger.warn("Redis no disponible para rate limiting, usando fallback en memoria del proceso", {
        error: (error as Error).message,
      });
      return this.memoryStore.increment(key);
    }
  }

  public async decrement(key: string): Promise<void> {
    await Promise.allSettled([this.redisStore.decrement(key), this.memoryStore.decrement(key)]);
  }

  public async resetKey(key: string): Promise<void> {
    await Promise.allSettled([this.redisStore.resetKey(key), this.memoryStore.resetKey(key)]);
  }
}

export default HybridRateLimitStore;

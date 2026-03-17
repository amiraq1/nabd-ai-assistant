import { createClient } from "redis";
import "../load-env.js";

export interface CacheStore {
  getJson<T>(key: string): Promise<T | null>;
  setJson<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  deleteByPrefix(prefix: string): Promise<void>;
}

class InMemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, { value: string; expiresAt: number }>();

  private purgeExpired(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) {
      return;
    }

    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    this.purgeExpired(key);
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }

    return JSON.parse(entry.value) as T;
  }

  async setJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.entries.set(key, {
      value: JSON.stringify(value),
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    for (const key of Array.from(this.entries.keys())) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
      }
    }
  }
}

class RedisCacheStore implements CacheStore {
  constructor(private readonly client: ReturnType<typeof createClient>) {}

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as T;
  }

  async setJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), {
      EX: ttlSeconds,
    });
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    const iterator = this.client.scanIterator({
      MATCH: `${prefix}*`,
      COUNT: 100,
    });

    for await (const key of iterator) {
      if (key) {
        await this.client.del(key);
      }
    }
  }
}

class FallbackCacheStore implements CacheStore {
  constructor(
    private readonly primary: CacheStore,
    private readonly secondary: CacheStore,
  ) {}

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const primaryValue = await this.primary.getJson<T>(key);
      if (primaryValue !== null) {
        return primaryValue;
      }
    } catch {
      return this.secondary.getJson<T>(key);
    }

    return this.secondary.getJson<T>(key);
  }

  async setJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.secondary.setJson(key, value, ttlSeconds);

    try {
      await this.primary.setJson(key, value, ttlSeconds);
    } catch {
      // Fallback cache is already hydrated.
    }
  }

  async delete(key: string): Promise<void> {
    await this.secondary.delete(key);

    try {
      await this.primary.delete(key);
    } catch {
      // Ignore primary cache deletion failures.
    }
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    await this.secondary.deleteByPrefix(prefix);

    try {
      await this.primary.deleteByPrefix(prefix);
    } catch {
      // Ignore primary cache deletion failures.
    }
  }
}

let cacheStorePromise: Promise<CacheStore> | null = null;

async function createRedisBackedCache(): Promise<CacheStore | null> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    return null;
  }

  const client = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 250, 3_000),
    },
  });

  client.on("error", (error) => {
    console.warn("[cache] redis error:", error);
  });

  try {
    await client.connect();
    return new FallbackCacheStore(new RedisCacheStore(client), new InMemoryCacheStore());
  } catch (error) {
    console.warn("[cache] failed to connect to redis, falling back to memory cache:", error);
    try {
      await client.disconnect();
    } catch {
      // Ignore disconnect failures while falling back.
    }
    return null;
  }
}

export async function getCacheStore(): Promise<CacheStore> {
  if (!cacheStorePromise) {
    cacheStorePromise = createRedisBackedCache().then(
      (store) => store ?? new InMemoryCacheStore(),
    );
  }

  return cacheStorePromise;
}

import { Redis } from "@upstash/redis";
import type { Indicator } from "./indicators";

type CacheEntry = {
  indicator: Indicator;
  timestamp: number;
};

// TTL de seguridad: datos más viejos que esto no valen ni como "previos".
const TTL_SECONDS = 48 * 60 * 60;

const PREFIX = "valapp:cache:";

// Si no hay variables (p. ej. un clon del repo sin .env.local), el cache
// degrada a no-op: la app funciona igual, solo sin stale fallback.
function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = getRedis();

export async function rememberSuccess(
  key: string,
  indicator: Indicator
): Promise<void> {
  if (!redis || !indicator.ok) return;
  try {
    const entry: CacheEntry = { indicator, timestamp: Date.now() };
    await redis.set(PREFIX + key, JSON.stringify(entry), { ex: TTL_SECONDS });
  } catch {
    // El cache nunca debe ser un punto de fallo nuevo.
  }
}

export async function getStale(
  key: string
): Promise<{ indicator: Indicator; ageMs: number } | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get<string | CacheEntry>(PREFIX + key);
    if (!raw) return null;

    // El SDK puede devolver el JSON ya parseado o como string, según config.
    const entry: CacheEntry =
      typeof raw === "string" ? JSON.parse(raw) : raw;

    if (!entry?.indicator || typeof entry.timestamp !== "number") return null;

    return {
      indicator: entry.indicator,
      ageMs: Date.now() - entry.timestamp,
    };
  } catch {
    return null;
  }
}
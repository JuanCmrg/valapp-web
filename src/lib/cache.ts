import { Redis } from "@upstash/redis";

export type CachePolicy = {
  /** Mientras el dato tenga menos de esta edad no se consulta la fuente. */
  freshMs: number;
  /** Hasta esta edad el dato sirve de respaldo si la fuente falla. */
  staleMs: number;
  /**
   * Consultar Redis antes de ir a la fuente. Útil para series lentas y pesadas;
   * en cotizaciones basta con la memoria y Redis se lee solo si la fuente falla.
   */
  readThrough?: boolean;
  /** Intervalo mínimo entre escrituras a Redis, para cuidar la cuota. */
  persistEveryMs?: number;
};

export type CacheResult<T> = { value: T; ageMs: number; stale: boolean };

type Entry<T> = { value: T; timestamp: number };

const PREFIX = "valapp:v2:";
const RETRY_AFTER_FAILURE_MS = 20_000;

// Sin variables de entorno (p. ej. un clon sin .env.local) el cache degrada a
// solo memoria: la app funciona igual.
function createRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = createRedis();
const memory = new Map<string, Entry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
const lastPersist = new Map<string, number>();
const lastFailure = new Map<string, { at: number; error: unknown }>();

async function readRedis<T>(key: string): Promise<Entry<T> | null> {
  if (!redis) return null;
  try {
    // El SDK puede devolver el JSON ya parseado o como string.
    const raw = await redis.get<string | Entry<T>>(PREFIX + key);
    if (!raw) return null;
    const entry: Entry<T> = typeof raw === "string" ? JSON.parse(raw) : raw;
    return typeof entry?.timestamp === "number" ? entry : null;
  } catch {
    return null; // El cache nunca debe ser un punto de fallo nuevo.
  }
}

async function writeRedis<T>(key: string, entry: Entry<T>, policy: CachePolicy) {
  if (!redis) return;
  const last = lastPersist.get(key) ?? 0;
  if (entry.timestamp - last < (policy.persistEveryMs ?? 0)) return;
  lastPersist.set(key, entry.timestamp);
  try {
    await redis.set(PREFIX + key, JSON.stringify(entry), {
      ex: Math.ceil(policy.staleMs / 1000),
    });
  } catch {
    // Ídem.
  }
}

function result<T>(entry: Entry<T>, now: number, stale: boolean): CacheResult<T> {
  return { value: entry.value, ageMs: now - entry.timestamp, stale };
}

/**
 * Devuelve el dato desde memoria, Redis o la fuente, en ese orden, y usa una
 * lectura previa si la fuente falla. Lanza solo si no hay ningún respaldo.
 */
export async function cached<T>(
  key: string,
  policy: CachePolicy,
  fetcher: () => Promise<T>
): Promise<CacheResult<T>> {
  const now = Date.now();
  let known = memory.get(key) as Entry<T> | undefined;
  if (known && now - known.timestamp < policy.freshMs) {
    return result(known, now, false);
  }

  const running = inFlight.get(key) as Promise<CacheResult<T>> | undefined;
  if (running) return running;

  const task = (async (): Promise<CacheResult<T>> => {
    if (!known && policy.readThrough) {
      const shared = await readRedis<T>(key);
      if (shared) {
        memory.set(key, shared);
        known = shared;
        if (now - shared.timestamp < policy.freshMs) {
          return result(shared, now, false);
        }
      }
    }

    const failure = lastFailure.get(key);
    let error: unknown;
    if (failure && now - failure.at < RETRY_AFTER_FAILURE_MS) {
      error = failure.error; // Evita martillar una fuente caída.
    } else {
      try {
        const entry: Entry<T> = { value: await fetcher(), timestamp: Date.now() };
        memory.set(key, entry);
        lastFailure.delete(key);
        await writeRedis(key, entry, policy);
        return result(entry, entry.timestamp, false);
      } catch (e) {
        error = e;
        lastFailure.set(key, { at: Date.now(), error: e });
      }
    }

    const backup = known ?? (await readRedis<T>(key));
    if (backup && now - backup.timestamp < policy.staleMs) {
      memory.set(key, backup);
      return result(backup, now, true);
    }
    throw error;
  })();

  inFlight.set(key, task);
  try {
    return await task;
  } finally {
    inFlight.delete(key);
  }
}

/** Solo para pruebas. */
export function __resetCacheForTests() {
  memory.clear();
  inFlight.clear();
  lastPersist.clear();
  lastFailure.clear();
}

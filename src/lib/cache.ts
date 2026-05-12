import type { Indicator } from "./indicators";

type CacheEntry = {
  indicator: Indicator;
  timestamp: number;
};

const cache = new Map<string, CacheEntry>();

export function rememberSuccess(key: string, indicator: Indicator) {
  if (indicator.ok) {
    cache.set(key, { indicator, timestamp: Date.now() });
  }
}

export function getStale(key: string): { indicator: Indicator; ageMs: number } | null {
  const entry = cache.get(key);
  if (!entry) return null;
  return {
    indicator: entry.indicator,
    ageMs: Date.now() - entry.timestamp,
  };
}
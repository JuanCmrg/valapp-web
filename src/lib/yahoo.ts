import { cached } from "./cache";
import type { YahooDef } from "./catalog";
import { exchangeOf, resolveMarketState, statusLabelFor, type TradingPeriods } from "./marketHours";
import type { ChartPoint, Indicator, RangeKey } from "./types";

const DAY_MS = 86_400_000;

type YahooMeta = {
  currency?: string;
  regularMarketPrice?: number;
  regularMarketTime?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  currentTradingPeriod?: TradingPeriods;
};

export type YahooResult = {
  meta?: YahooMeta;
  timestamp?: number[];
  indicators?: { quote?: { close?: (number | null)[] }[] };
};

async function fetchChart(symbol: string, query: string): Promise<YahooResult> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${query}`,
    {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error("Sin datos");
  return result;
}

function downsample(data: number[], target = 60): number[] {
  if (data.length <= target) return data;
  const step = data.length / target;
  const out: number[] = [];
  for (let i = 0; i < target - 1; i++) out.push(data[Math.floor(i * step)]);
  out.push(data[data.length - 1]); // conservar siempre el último tick
  return out;
}

const isPrice = (c: unknown): c is number => typeof c === "number" && c > 0;

/** Convierte la respuesta de Yahoo en la tarjeta del indicador. */
export function indicatorFromChart(def: YahooDef, result: YahooResult, now: Date): Indicator {
  const meta = result.meta;
  if (meta?.regularMarketPrice === undefined) throw new Error("Sin precio");

  const price = Number(meta.regularMarketPrice);
  const prev = meta.chartPreviousClose ?? meta.previousClose;
  const periods = meta.currentTradingPeriod;
  const exchange = exchangeOf(def.symbol);
  const marketState = exchange ? resolveMarketState(exchange, periods, now) : "closed";

  const out: Indicator = {
    id: def.id,
    label: def.label,
    category: def.category,
    source: "Yahoo Finance",
    sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(def.symbol)}`,
    description: def.description,
    value: price,
    unit: def.unit ?? meta.currency ?? "",
    decimals: def.decimals,
    ok: true,
    marketState,
    statusLabel: statusLabelFor(marketState),
  };

  if (typeof prev === "number" && prev !== 0) {
    out.previousClose = prev;
    out.change = price - prev;
    out.changePercent = ((price - prev) / prev) * 100;
  }

  const stats: { label: string; value: number }[] = [];
  const pushStat = (label: string, value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) stats.push({ label, value });
  };
  pushStat("Cierre anterior", prev);
  pushStat("Mínimo del día", meta.regularMarketDayLow);
  pushStat("Máximo del día", meta.regularMarketDayHigh);
  pushStat("Mínimo 52 sem.", meta.fiftyTwoWeekLow);
  pushStat("Máximo 52 sem.", meta.fiftyTwoWeekHigh);
  out.stats = stats;

  const timestamps = result.timestamp;
  const closes = result.indicators?.quote?.[0]?.close;
  const lastRegular = meta.regularMarketTime;

  // Mini-gráfica intradía, solo con barras de la sesión regular.
  if (Array.isArray(closes)) {
    const regular = closes.filter(
      (c, i) =>
        isPrice(c) &&
        (!timestamps || typeof lastRegular !== "number" || timestamps[i] <= lastRegular)
    ) as number[];
    if (regular.length >= 5) out.spark = downsample(regular);
  }

  // Solo las acciones de EE. UU. tienen pre-market y after-hours confiables:
  // los índices se calculan, y forex y futuros operan casi continuo.
  if (
    exchange === "NYSE" &&
    Array.isArray(timestamps) &&
    Array.isArray(closes) &&
    typeof lastRegular === "number"
  ) {
    for (let i = timestamps.length - 1; i >= 0; i--) {
      const ts = timestamps[i];
      const c = closes[i];
      if (ts <= lastRegular) break;
      if (!isPrice(c) || Math.abs(c - price) <= 0.001) continue;

      const change = c - price;
      const percent = (change / price) * 100;
      const pre = periods?.pre;
      if (pre && ts >= pre.start && ts < pre.end) {
        out.preMarketPrice = c;
        out.preMarketChange = change;
        out.preMarketChangePercent = percent;
      } else {
        out.afterHoursPrice = c;
        out.afterHoursChange = change;
        out.afterHoursChangePercent = percent;
      }
      break;
    }
  }

  return out;
}

export async function getYahooQuote(def: YahooDef): Promise<{
  indicator: Indicator;
  ageMs: number;
  stale: boolean;
}> {
  const { value, ageMs, stale } = await cached<YahooResult>(
    `yahoo:${def.id}`,
    // Respaldo escrito cada 10 min: tantos símbolos no deben gastar la cuota de Redis.
    { freshMs: 30_000, staleMs: 7 * DAY_MS, persistEveryMs: 10 * 60_000 },
    () => fetchChart(def.symbol, "includePrePost=true&interval=5m&range=1d")
  );
  return { indicator: indicatorFromChart(def, value, new Date()), ageMs, stale };
}

const RANGE_QUERY: Partial<Record<RangeKey, { range: string; interval: string }>> = {
  "1D": { range: "1d", interval: "5m" },
  "5D": { range: "5d", interval: "30m" },
  "1M": { range: "1mo", interval: "1d" },
  "6M": { range: "6mo", interval: "1d" },
  "1A": { range: "1y", interval: "1d" },
  "5A": { range: "5y", interval: "1wk" },
};

export async function getYahooChart(def: YahooDef, range: RangeKey): Promise<ChartPoint[]> {
  const q = RANGE_QUERY[range];
  if (!q) return [];
  const { value } = await cached<ChartPoint[]>(
    `yahoo:chart:${def.id}:${range}`,
    {
      freshMs: range === "1D" || range === "5D" ? 60_000 : 30 * 60_000,
      staleMs: 7 * DAY_MS,
      persistEveryMs: 60 * 60_000,
    },
    async () => {
      const r = await fetchChart(def.symbol, `interval=${q.interval}&range=${q.range}`);
      const closes = r.indicators?.quote?.[0]?.close ?? [];
      const points: ChartPoint[] = [];
      (r.timestamp ?? []).forEach((t, i) => {
        const c = closes[i];
        if (isPrice(c)) points.push([t * 1000, c]);
      });
      return points;
    }
  );
  return value;
}

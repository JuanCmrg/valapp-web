import { getSeries } from "./banrep";
import { indicatorFromSeries } from "./banrepIndicator";
import { CATALOG, CATEGORIES, type IndicatorDef } from "./catalog";
import type { Category, Indicator, Snapshot } from "./types";
import { getYahooQuote } from "./yahoo";

function failed(def: IndicatorDef, e: unknown): Indicator {
  return {
    id: def.id,
    label: def.label,
    category: def.category,
    source: def.provider === "banrep" ? "Banco de la República" : "Yahoo Finance",
    description: def.description,
    unit: def.unit ?? "",
    decimals: def.decimals,
    value: null,
    ok: false,
    error: e instanceof Error ? e.message : String(e),
  };
}

export async function getIndicator(def: IndicatorDef): Promise<Indicator> {
  try {
    if (def.provider === "banrep") {
      const { value, ageMs, stale } = await getSeries(def);
      const indicator = indicatorFromSeries(def, value.points, value.sourceLabel, Date.now());
      return stale
        ? { ...indicator, stale: true, staleAgeMs: ageMs, statusLabel: "Guardado" }
        : indicator;
    }
    const { indicator, ageMs, stale } = await getYahooQuote(def);
    return stale
      ? { ...indicator, stale: true, staleAgeMs: ageMs, statusLabel: "Guardado", marketState: undefined }
      : indicator;
  } catch (e) {
    console.error(`[indicators] ${def.id}:`, e);
    return failed(def, e);
  }
}

export async function getSnapshot(): Promise<Snapshot> {
  const indicators = await Promise.all(CATALOG.map(getIndicator));
  const categories: Category[] = CATEGORIES.map((title) => ({
    title,
    indicators: indicators.filter((i) => i.category === title),
  }));
  return { categories, generatedAt: Date.now() };
}

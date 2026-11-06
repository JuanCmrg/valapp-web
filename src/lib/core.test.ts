import { beforeEach, describe, expect, it, vi } from "vitest";
import { monthlyVariation, parseSeriesPoints } from "./banrep";
import { endOfBogotaDay, indicatorFromSeries, periodLabel } from "./banrepIndicator";
import { __resetCacheForTests, cached } from "./cache";
import { CATALOG, defById, type BanrepDef, type YahooDef } from "./catalog";
import { fmtSigned } from "./format";
import { exchangeOf, resolveMarketState } from "./marketHours";
import type { ChartPoint } from "./types";
import { indicatorFromChart } from "./yahoo";

// Las fechas del Banrep son medianoche en Bogotá: 05:00 UTC.
const day = (d: string) => Date.parse(`${d}T05:00:00Z`);
const trm = defById("trm") as BanrepDef;

describe("indicatorFromSeries", () => {
  const points: ChartPoint[] = [
    [day("2026-11-04"), 3235.59],
    [day("2026-11-05"), 3221.19],
    [day("2026-11-06"), 3228.26],
  ];

  it("usa el valor vigente hoy y deja el futuro como próximo", () => {
    const now = Date.parse("2026-11-05T23:00:00-05:00");
    const ind = indicatorFromSeries(trm, points, "Banrep", now);
    expect(ind.value).toBe(3221.19);
    expect(ind.referenceDate).toBe("5 nov 2026");
    expect(ind.change).toBeCloseTo(-14.4);
    expect(ind.next).toEqual({ value: 3228.26, referenceDate: "6 nov 2026" });
    expect(ind.spark).toEqual([3235.59, 3221.19]);
    expect(ind.history?.[ind.historyIndex!].value).toBe(3221.19);
  });

  it("avanza al cambiar el día en Bogotá aunque la serie esté en cache", () => {
    const now = Date.parse("2026-11-06T00:00:01-05:00");
    expect(indicatorFromSeries(trm, points, "Banrep", now).value).toBe(3228.26);
  });

  it("toma el dato anual del año en curso aunque esté fechado a fin de año", () => {
    const smmlv = defById("smmlv") as BanrepDef;
    const ind = indicatorFromSeries(
      smmlv,
      [
        [day("2025-12-31"), 1423500],
        [day("2026-12-31"), 1750905],
      ],
      "Banrep",
      Date.parse("2026-11-05T12:00:00-05:00")
    );
    expect(ind.value).toBe(1750905);
    expect(ind.referenceDate).toBe("2026");
    expect(ind.next).toBeUndefined();
  });

  it("no anuncia como próximo un mes que solo está fechado a fin de período", () => {
    const meta = defById("metaInflacion") as BanrepDef;
    const ind = indicatorFromSeries(
      meta,
      [
        [day("2026-10-31"), 3],
        [day("2026-11-30"), 3],
      ],
      "Banrep",
      Date.parse("2026-11-05T12:00:00-05:00")
    );
    expect(ind.next).toBeUndefined();
    expect(ind.history).toHaveLength(1);
  });

  it("expresa en puntos porcentuales las series que ya son porcentaje", () => {
    const ipc = defById("ipc12") as BanrepDef;
    const ind = indicatorFromSeries(
      ipc,
      [
        [day("2026-08-31"), 6.24],
        [day("2026-09-30"), 6.29],
      ],
      "Banrep",
      Date.now()
    );
    expect(ind.changeUnit).toBe("pp");
    expect(ind.changePercent).toBeUndefined();
    expect(ind.referenceDate).toBe("sep 2026");
  });
});

describe("utilidades de series", () => {
  it("calcula la inflación mensual desde el índice", () => {
    const out = monthlyVariation([
      [1, 160.42],
      [2, 161],
    ]);
    expect(out).toEqual([[2, 0.36]]);
  });

  it("descarta puntos inválidos y ordena", () => {
    expect(parseSeriesPoints([[2, 1], [1, 2], [3, null], "x"])).toEqual([
      [1, 2],
      [2, 1],
    ]);
    expect(parseSeriesPoints(undefined)).toEqual([]);
  });

  it("etiqueta trimestres y años", () => {
    expect(periodLabel(day("2026-06-30"), "quarterly")).toBe("2T 2026");
    expect(periodLabel(day("2026-12-31"), "annual")).toBe("2026");
  });

  it("calcula el fin del día en Bogotá", () => {
    expect(endOfBogotaDay(Date.parse("2026-11-05T23:59:00-05:00"))).toBe(day("2026-11-06"));
  });
});

describe("cached", () => {
  beforeEach(() => __resetCacheForTests());
  const policy = { freshMs: 1000, staleMs: 100_000 };

  it("no consulta la fuente mientras el dato está fresco", async () => {
    const fetcher = vi.fn().mockResolvedValue(1);
    await cached("a", policy, fetcher);
    const r = await cached("a", policy, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(r.stale).toBe(false);
  });

  it("usa el respaldo si la fuente falla y lo marca como viejo", async () => {
    await cached("b", { ...policy, freshMs: 0 }, async () => 1);
    const r = await cached("b", { ...policy, freshMs: 0 }, async () => {
      throw new Error("caída");
    });
    expect(r).toMatchObject({ value: 1, stale: true });
  });

  it("propaga el error si no hay respaldo", async () => {
    await expect(
      cached("c", policy, async () => {
        throw new Error("caída");
      })
    ).rejects.toThrow("caída");
  });

  it("no martilla una fuente caída", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("caída"));
    await expect(cached("d", policy, fetcher)).rejects.toThrow();
    await expect(cached("d", policy, fetcher)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("estado del mercado", () => {
  // Jueves 5 nov 2026, 11:00 a. m. en Nueva York.
  const open = new Date("2026-11-05T16:00:00Z");
  const t = open.getTime() / 1000;
  const today = { start: t - 3600, end: t + 3600 };
  const nextDay = { start: t + 80_000, end: t + 90_000 };

  it("abierto si el horario y Yahoo coinciden", () => {
    expect(resolveMarketState("NYSE", { regular: today }, open)).toBe("live");
  });

  it("cerrado en festivo aunque el horario diga abierto", () => {
    expect(resolveMarketState("NYSE", { regular: nextDay }, open)).toBe("closed");
  });

  it("forex no depende de la sesión de Yahoo", () => {
    expect(resolveMarketState("FOREX", { regular: nextDay }, open)).toBe("live");
  });

  it("todos los símbolos del catálogo tienen bolsa asignada", () => {
    for (const d of CATALOG) {
      if (d.provider === "yahoo") expect(exchangeOf(d.symbol), d.symbol).not.toBeNull();
    }
  });
});

describe("indicatorFromChart", () => {
  const nvda = defById("nvda") as YahooDef;
  const base = {
    currency: "USD",
    regularMarketPrice: 100,
    chartPreviousClose: 110,
    regularMarketTime: 1000,
  };

  it("calcula la variación contra el cierre anterior", () => {
    const ind = indicatorFromChart(nvda, { meta: base }, new Date());
    expect(ind.change).toBeCloseTo(-10);
    expect(ind.changePercent).toBeCloseTo(-9.0909, 3);
  });

  it("distingue after-hours de pre-market según la sesión", () => {
    const chart = (period: { start: number; end: number }) => ({
      meta: { ...base, currentTradingPeriod: { pre: period } },
      timestamp: [900, 1100],
      indicators: { quote: [{ close: [100, 102] }] },
    });
    const pre = indicatorFromChart(nvda, chart({ start: 1050, end: 1200 }), new Date());
    expect(pre.preMarketPrice).toBe(102);
    expect(pre.afterHoursPrice).toBeUndefined();

    const post = indicatorFromChart(nvda, chart({ start: 1, end: 2 }), new Date());
    expect(post.afterHoursPrice).toBe(102);
    expect(post.preMarketPrice).toBeUndefined();
  });

  it("lanza si no hay precio", () => {
    expect(() => indicatorFromChart(nvda, { meta: {} }, new Date())).toThrow("Sin precio");
  });
});

describe("fmtSigned", () => {
  it("nunca muestra -0,00", () => {
    expect(fmtSigned(-0.001)).toBe("0,00");
    expect(fmtSigned(1.5)).toBe("+1,50");
  });
});

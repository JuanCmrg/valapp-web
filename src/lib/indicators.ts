import { exchangeOf, getMarketState, statusLabelFor } from "./marketHours";
import { rememberSuccess, getStale } from "./cache";

export type Indicator = {
  label: string;
  source: string;
  value: number | null;
  unit: string;
  ok: boolean;
  error?: string;
  previousClose?: number;
  change?: number;
  changePercent?: number;
  statusLabel?: string;
  marketState?: "live" | "afterhours" | "closed";
  referenceDate?: string;
  dateLabel?: string;
  stale?: boolean;
  staleAgeMs?: number;
  afterHoursPrice?: number;
  afterHoursChange?: number;
  afterHoursChangePercent?: number;
  preMarketPrice?: number;
  preMarketChange?: number;
  preMarketChangePercent?: number;
  intradaySeries?: number[];
};

const BANREP_BASE =
  "https://suameca.banrep.gov.co/estadisticas-economicas-back/rest/estadisticaEconomicaRestService/consultaMenuXId?idMenu=";

const BANREP_HEADERS = {
  Referer: "https://suameca.banrep.gov.co/estadisticas-economicas",
  Origin: "https://suameca.banrep.gov.co",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "es-CO,es;q=0.9,en;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
};

async function fetchBanrep(idMenu: number) {
  const res = await fetch(`${BANREP_BASE}${idMenu}`, {
    headers: BANREP_HEADERS,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function formatDate(raw: unknown): string | undefined {
  if (raw === null || raw === undefined) return undefined;

  const MESES = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
  ];

  if (typeof raw === "string") {
    const ddmmyyyy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      const m = Number(month);
      if (m >= 1 && m <= 12) {
        return `${Number(day)} de ${MESES[m - 1]} de ${year}`;
      }
    }

    if (/^\d{1,2}\s+de\s+\w+\s+de\s+\d{4}$/i.test(raw)) {
      return raw.replace(/\s+/g, " ").trim();
    }
  }

  if (typeof raw === "number") {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return undefined;
    return d.toLocaleDateString("es-CO", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "America/Bogota",
    });
  }

  return undefined;
}

function ok(
  label: string,
  source: string,
  value: number,
  unit: string,
  extras: Partial<Indicator> = {}
): Indicator {
  return {
    label,
    source,
    value,
    unit,
    ok: true,
    statusLabel: "En vivo",
    marketState: "live",
    ...extras,
  };
}

function fail(
  label: string,
  source: string,
  unit: string,
  err: unknown
): Indicator {
  return {
    label,
    source,
    unit,
    value: null,
    ok: false,
    error: err instanceof Error ? err.message : String(err),
  };
}

async function withCacheFallback(
  cacheKey: string,
  fetcher: () => Promise<Indicator>
): Promise<Indicator> {
  const fresh = await fetcher();
  if (fresh.ok) {
    rememberSuccess(cacheKey, fresh);
    return fresh;
  }

  const stale = getStale(cacheKey);
  if (stale) {
    return {
      ...stale.indicator,
      stale: true,
      staleAgeMs: stale.ageMs,
      statusLabel: "Datos previos",
    };
  }

  return fresh;
}

async function banrepSeries(
  label: string,
  idMenu: number,
  unit: string,
  options: {
    seriesIdx?: number;
    dateLabel?: string;
  } = {}
): Promise<Indicator> {
  const { seriesIdx = 0, dateLabel = "Vigente" } = options;
  try {
    const data = await fetchBanrep(idMenu);
    const serie = data?.SERIES?.[seriesIdx];
    if (serie?.valor === undefined) {
      throw new Error(`Sin SERIES[${seriesIdx}].valor`);
    }

    const fechaRaw =
      serie?.fecha ??
      serie?.fechaFinal ??
      serie?.fechaUltimoCargue ??
      serie?.fechaInicio;

    return ok(label, "Banco de la República", Number(serie.valor), unit, {
      statusLabel: "Oficial",
      marketState: undefined,
      referenceDate: formatDate(fechaRaw),
      dateLabel,
    });
  } catch (e) {
    return fail(label, "Banco de la República", unit, e);
  }
}

export const getTrm = () =>
  withCacheFallback("trm", () =>
    banrepSeries("TRM", 1, "COP/USD", { dateLabel: "Vigente" })
  );

export const getUvr = () =>
  withCacheFallback("uvr", async () => {
    try {
      const data = await fetchBanrep(100005);
      const series: any[] = data?.SERIES ?? [];

      if (series.length === 0) throw new Error("Sin series de UVR");

      const todayStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Bogota",
      }).format(new Date()); // "2026-05-14"

      function parseSerieDate(serie: any): Date | null {
        const raw =
          serie?.fecha ?? serie?.fechaFinal ?? serie?.fechaInicio ?? null;
        if (!raw || typeof raw !== "string") return null;
        // dd/mm/yyyy
        const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (m) {
          const [, day, month, year] = m;
          return new Date(
            `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
          );
        }
        // yyyy-mm-dd
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(raw);
        return null;
      }

      const today = new Date(todayStr);
      let best: { serie: any; date: Date } | null = null;

      for (const serie of series) {
        if (serie?.valor === undefined) continue;
        const d = parseSerieDate(serie);
        if (!d || isNaN(d.getTime())) continue;
        if (d <= today && (!best || d > best.date)) {
          best = { serie, date: d };
        }
      }

      // Fallback: si ninguna fecha parseó, usar SERIES[0] como antes
      if (!best) {
        const serie = series[0];
        if (serie?.valor === undefined) throw new Error("Sin valor de UVR");
        return ok("UVR", "Banco de la República", Number(serie.valor), "COP/UVR", {
          statusLabel: "Oficial",
          marketState: undefined,
          referenceDate: formatDate(
            serie?.fecha ?? serie?.fechaFinal ?? serie?.fechaInicio
          ),
          dateLabel: "Vigente",
        });
      }

      return ok("UVR", "Banco de la República", Number(best.serie.valor), "COP/UVR", {
        statusLabel: "Oficial",
        marketState: undefined,
        referenceDate: formatDate(
          best.serie.fecha ?? best.serie.fechaFinal ?? best.serie.fechaInicio
        ),
        dateLabel: "Vigente",
      });
    } catch (e) {
      return fail("UVR", "Banco de la República", "COP/UVR", e);
    }
  });

export const getSmmlv = () =>
  withCacheFallback("smmlv", () =>
    banrepSeries("SMMLV", 500023, "COP", { dateLabel: "Año fiscal" })
  );

export const getPib = () =>
  withCacheFallback("pib", () =>
    banrepSeries("PIB anual", 500011, "%", { dateLabel: "Período" })
  );

export const getIpc12 = () =>
  withCacheFallback("ipc12", () =>
    banrepSeries("IPC 12 meses", 100001, "%", {
      seriesIdx: 1,
      dateLabel: "Cierre",
    })
  );

export function getIpcMensual(): Promise<Indicator> {
  return withCacheFallback("ipcMensual", async () => {
    try {
      const res = await fetch(
        "https://sen.dane.gov.co/services_ipc/rest/IpcServices/getLastTotVariation",
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const row = data?.[0];
      const value = row?.value;
      if (value === undefined) throw new Error("Estructura inesperada");

      return ok("IPC mensual", "DANE", Number(value), "%", {
        statusLabel: "Oficial",
        marketState: undefined,
        referenceDate: formatDate(row?.date ?? row?.fecha ?? row?.referenceDate),
        dateLabel: "Cierre",
      });
    } catch (e) {
      return fail("IPC mensual", "DANE", "%", e);
    }
  });
}

export function getYahoo(symbol: string, label: string): Promise<Indicator> {
  return withCacheFallback(`yahoo:${symbol}`, async () => {
    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?includePrePost=true&interval=5m&range=1d`,
        { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const result = data?.chart?.result?.[0];
      const meta = result?.meta;
      if (meta?.regularMarketPrice === undefined) throw new Error("Sin precio");

      const price = Number(meta.regularMarketPrice);
      const prevRaw = meta.chartPreviousClose ?? meta.previousClose;

      const exchange = exchangeOf(symbol);
      const marketState = exchange ? getMarketState(exchange) : "closed";
      const statusLabel = statusLabelFor(marketState);

      const extras: Partial<Indicator> = { marketState, statusLabel };
      if (typeof prevRaw === "number" && prevRaw !== 0) {
        const change = price - prevRaw;
        extras.previousClose = prevRaw;
        extras.change = change;
        extras.changePercent = (change / prevRaw) * 100;
      }

      const timestamps: number[] | undefined = result?.timestamp;
      const closes: (number | null)[] | undefined =
        result?.indicators?.quote?.[0]?.close;
      const regularMarketTime: number | undefined = meta?.regularMarketTime;

      if (Array.isArray(closes)) {
        const validCloses = closes.filter(
          (c): c is number => typeof c === "number" && c > 0
        );
        if (validCloses.length >= 5) {
          extras.intradaySeries = validCloses;
        }
      }

      if (
        Array.isArray(timestamps) &&
        Array.isArray(closes) &&
        typeof regularMarketTime === "number" &&
        timestamps.length === closes.length
      ) {
        let postClose: number | undefined;
        for (let i = timestamps.length - 1; i >= 0; i--) {
          if (timestamps[i] > regularMarketTime) {
            const c = closes[i];
            if (typeof c === "number" && c > 0) {
              postClose = c;
              break;
            }
          }
        }

        if (postClose !== undefined && Math.abs(postClose - price) > 0.001) {
          const ahChange = postClose - price;
          extras.afterHoursPrice = postClose;
          extras.afterHoursChange = ahChange;
          extras.afterHoursChangePercent = (ahChange / price) * 100;
        }
      }

      return ok(label, "Yahoo Finance", price, meta.currency ?? "", extras);
    } catch (e) {
      return fail(label, "Yahoo Finance", "", e);
    }
  });
}
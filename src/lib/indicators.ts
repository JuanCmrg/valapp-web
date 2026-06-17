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
  history?: { value: number; referenceDate: string; dateLabel: string }[];
  historyIndex?: number;
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
  withCacheFallback("trm", async () => {
    try {
      const data = await fetchBanrep(1);
      const serie = data?.SERIES?.[0];
      if (!serie) throw new Error("Sin SERIES");

      // Detectar el array [[timestamp, valor], ...] por forma (igual que UVR)
      let datos: [number, number][] | null = null;
      for (const v of Object.values(serie)) {
        if (
          Array.isArray(v) &&
          v.length > 0 &&
          Array.isArray(v[0]) &&
          v[0].length === 2 &&
          typeof v[0][0] === "number" &&
          typeof v[0][1] === "number"
        ) {
          datos = v as [number, number][];
          break;
        }
      }
      if (!datos || datos.length === 0) {
        throw new Error("Sin puntos en la serie de TRM");
      }

      // Ordenar ascendente por timestamp por seguridad
      datos.sort((a, b) => a[0] - b[0]);

      // Construir el historial navegable con fechas formateadas
      const history = datos.map(([ts, valor]) => {
        const ymd = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Bogota",
        }).format(new Date(ts)); // "2026-05-14"
        const [y, mo, d] = ymd.split("-");
        return {
          value: valor,
          referenceDate: formatDate(`${d}/${mo}/${y}`) ?? `${d}/${mo}/${y}`,
          dateLabel: "Vigente",
        };
      });

      // Encontrar el índice del punto vigente HOY (último con fecha ≤ hoy)
      const todayYmd = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Bogota",
      }).format(new Date());
      const tomorrowBogotaMs =
        new Date(`${todayYmd}T05:00:00Z`).getTime() + 86_400_000;

      let todayIdx = 0;
      for (let i = 0; i < datos.length; i++) {
        if (datos[i][0] < tomorrowBogotaMs) todayIdx = i;
      }

      const current = history[todayIdx];

      return ok("TRM", "Banco de la República", current.value, "COP/USD", {
        statusLabel: "Oficial",
        marketState: undefined,
        referenceDate: current.referenceDate,
        dateLabel: "Vigente",
        history,
        historyIndex: todayIdx,
      });
    } catch (e) {
      return fail("TRM", "Banco de la República", "COP/USD", e);
    }
  });

export const getUvr = () =>
  withCacheFallback("uvr", async () => {
    try {
      const data = await fetchBanrep(100005);
      const serie = data?.SERIES?.[0];
      if (!serie) throw new Error("Sin SERIES");

      // Buscar el array [[timestamp, valor], ...] dentro de la serie.
      // No asumimos el nombre del campo — lo detectamos por forma.
      let datos: [number, number][] | null = null;
      for (const v of Object.values(serie)) {
        if (
          Array.isArray(v) &&
          v.length > 0 &&
          Array.isArray(v[0]) &&
          v[0].length === 2 &&
          typeof v[0][0] === "number" &&
          typeof v[0][1] === "number"
        ) {
          datos = v as [number, number][];
          break;
        }
      }
      if (!datos || datos.length === 0) {
        throw new Error("Sin puntos en la serie de UVR");
      }

      // Fecha de hoy en Bogotá (Colombia no usa DST → UTC-5)
      const todayYmd = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Bogota",
      }).format(new Date()); // "2026-05-14"
      const tomorrowBogotaMs =
        new Date(`${todayYmd}T05:00:00Z`).getTime() + 86_400_000;

      // Punto más reciente cuya fecha sea ≤ hoy
      let best: [number, number] | null = null;
      for (const point of datos) {
        if (point[0] < tomorrowBogotaMs && (!best || point[0] > best[0])) {
          best = point;
        }
      }
      if (!best) throw new Error("Sin valor de UVR para hoy");

      // Convertir el timestamp a "dd/mm/yyyy" para que formatDate lo formatee
      // igual que TRM ("14 de may de 2026")
      const bestYmd = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Bogota",
      }).format(new Date(best[0])); // "2026-05-14"
      const [by, bm, bd] = bestYmd.split("-");

      return ok("UVR", "Banco de la República", best[1], "COP/UVR", {
        statusLabel: "Oficial",
        marketState: undefined,
        referenceDate: formatDate(`${bd}/${bm}/${by}`),
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
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?includePrePost=true&interval=1m&range=1d`,
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

      // Sparkline intradía (filtramos a barras regulares para que se vea limpia)
      if (Array.isArray(closes)) {
        let regularCloses: number[];
        if (Array.isArray(timestamps) && typeof regularMarketTime === "number") {
          regularCloses = [];
          for (let i = 0; i < closes.length; i++) {
            const c = closes[i];
            if (
              typeof c === "number" &&
              c > 0 &&
              timestamps[i] <= regularMarketTime
            ) {
              regularCloses.push(c);
            }
          }
        } else {
          regularCloses = closes.filter(
            (c): c is number => typeof c === "number" && c > 0
          );
        }
        if (regularCloses.length >= 5) {
          extras.intradaySeries = regularCloses;
        }
      }

// Solo las acciones de NYSE tienen pre-market / after-hours reales.
      // Los índices no se negocian (son calculados), el forex y los futuros
      // operan ~24/5 sin "AH". El resto de plazas (BVC, TSE, B3) no exponen
      // AH/PM por Yahoo de forma confiable.
      const supportsAhPm = exchange === "NYSE";

      if (supportsAhPm) {
        // 1) Pre-market — desde meta si Yahoo lo expone
        if (
          typeof meta.preMarketPrice === "number" &&
          meta.preMarketPrice > 0 &&
          Math.abs(meta.preMarketPrice - price) > 0.001
        ) {
          extras.preMarketPrice = meta.preMarketPrice;
          extras.preMarketChange =
            typeof meta.preMarketChange === "number"
              ? meta.preMarketChange
              : meta.preMarketPrice - price;
          extras.preMarketChangePercent =
            typeof meta.preMarketChangePercent === "number"
              ? meta.preMarketChangePercent
              : ((meta.preMarketPrice - price) / price) * 100;
        }

        // 2) After-hours — primero desde meta…
        if (
          typeof meta.postMarketPrice === "number" &&
          meta.postMarketPrice > 0 &&
          Math.abs(meta.postMarketPrice - price) > 0.001
        ) {
          extras.afterHoursPrice = meta.postMarketPrice;
          extras.afterHoursChange =
            typeof meta.postMarketChange === "number"
              ? meta.postMarketChange
              : meta.postMarketPrice - price;
          extras.afterHoursChangePercent =
            typeof meta.postMarketChangePercent === "number"
              ? meta.postMarketChangePercent
              : ((meta.postMarketPrice - price) / price) * 100;
        }

        // …y si meta no lo trae, escanear las barras intradía (último tick AH)
        if (
          extras.afterHoursPrice === undefined &&
          Array.isArray(timestamps) &&
          Array.isArray(closes) &&
          typeof regularMarketTime === "number" &&
          timestamps.length === closes.length
        ) {
          for (let i = timestamps.length - 1; i >= 0; i--) {
            if (timestamps[i] > regularMarketTime) {
              const c = closes[i];
              if (
                typeof c === "number" &&
                c > 0 &&
                Math.abs(c - price) > 0.001
              ) {
                extras.afterHoursPrice = c;
                extras.afterHoursChange = c - price;
                extras.afterHoursChangePercent = ((c - price) / price) * 100;
                break;
              }
            }
          }
        }
      }

      return ok(label, "Yahoo Finance", price, meta.currency ?? "", extras);
    } catch (e) {
      return fail(label, "Yahoo Finance", "", e);
    }
  });
}
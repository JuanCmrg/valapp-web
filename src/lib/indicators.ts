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

// ─── BanRep series con etiqueta de fecha contextual ────────────────────
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

export const getTrm   = () => banrepSeries("TRM", 1, "COP/USD", { dateLabel: "Vigente" });
export const getUvr   = () => banrepSeries("UVR", 100005, "COP/UVR", { dateLabel: "Vigente" });
export const getSmmlv = () => banrepSeries("SMMLV", 500023, "COP", { dateLabel: "Año fiscal" });
export const getPib   = () => banrepSeries("PIB anual", 500011, "%", { dateLabel: "Período" });
export const getIpc12 = () =>
  banrepSeries("IPC 12 meses", 100001, "%", { seriesIdx: 1, dateLabel: "Cierre" });

// ─── DANE: IPC mensual ─────────────────────────────────────────────────
export async function getIpcMensual(): Promise<Indicator> {
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
}

// ─── Yahoo Finance con marketState ─────────────────────────────────────
function mapYahooMarketState(state: unknown): {
  marketState: "live" | "afterhours" | "closed";
  statusLabel: string;
} {
  switch (state) {
    case "REGULAR":
      return { marketState: "live", statusLabel: "En vivo" };
    case "PRE":
      return { marketState: "afterhours", statusLabel: "Pre-market" };
    case "POST":
      return { marketState: "afterhours", statusLabel: "After-hours" };
    case "CLOSED":
    case "PREPRE":
    case "POSTPOST":
      return { marketState: "closed", statusLabel: "Mercado cerrado" };
    default:
      return { marketState: "closed", statusLabel: "Mercado cerrado" };
  }
}

export async function getYahoo(
  symbol: string,
  label: string
): Promise<Indicator> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (meta?.regularMarketPrice === undefined) throw new Error("Sin precio");

    const price = Number(meta.regularMarketPrice);
    const prevRaw = meta.chartPreviousClose ?? meta.previousClose;
    const { marketState, statusLabel } = mapYahooMarketState(meta.marketState);

    const extras: Partial<Indicator> = { marketState, statusLabel };
    if (typeof prevRaw === "number" && prevRaw !== 0) {
      const change = price - prevRaw;
      extras.previousClose = prevRaw;
      extras.change = change;
      extras.changePercent = (change / prevRaw) * 100;
    }

    return ok(label, "Yahoo Finance", price, meta.currency ?? "", extras);
  } catch (e) {
    return fail(label, "Yahoo Finance", "", e);
  }
}
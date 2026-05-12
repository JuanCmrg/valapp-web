export type Indicator = {
  label: string;
  source: string;
  value: number | null;
  unit: string;
  ok: boolean;
  error?: string;
};

// ─── BanRep ────────────────────────────────────────────────────────────
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

// ─── Helpers de resultado ──────────────────────────────────────────────
function ok(
  label: string,
  source: string,
  value: number,
  unit: string
): Indicator {
  return { label, source, value, unit, ok: true };
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

// ─── Series de BanRep (mismo formato JSON) ─────────────────────────────
async function banrepSeries(
  label: string,
  idMenu: number,
  unit: string,
  seriesIdx = 0
): Promise<Indicator> {
  try {
    const data = await fetchBanrep(idMenu);
    const valor = data?.SERIES?.[seriesIdx]?.valor;
    if (valor === undefined) throw new Error(`Sin SERIES[${seriesIdx}].valor`);
    return ok(label, "Banco de la República", Number(valor), unit);
  } catch (e) {
    return fail(label, "Banco de la República", unit, e);
  }
}

export const getTrm   = () => banrepSeries("TRM", 1, "COP/USD");
export const getUvr   = () => banrepSeries("UVR", 100005, "COP/UVR");
export const getSmmlv = () => banrepSeries("SMMLV", 500023, "COP");
export const getPib   = () => banrepSeries("PIB anual", 500011, "%");
export const getIpc12 = () => banrepSeries("IPC 12 meses", 100001, "%", 1);

// ─── DANE: IPC mensual (estructura distinta) ───────────────────────────
export async function getIpcMensual(): Promise<Indicator> {
  try {
    const res = await fetch(
      "https://sen.dane.gov.co/services_ipc/rest/IpcServices/getLastTotVariation",
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const value = data?.[0]?.value;
    if (value === undefined) throw new Error("Estructura inesperada");
    return ok("IPC mensual", "DANE", Number(value), "%");
  } catch (e) {
    return fail("IPC mensual", "DANE", "%", e);
  }
}

// ─── Yahoo Finance ─────────────────────────────────────────────────────
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
    return ok(
      label,
      "Yahoo Finance",
      Number(meta.regularMarketPrice),
      meta.currency ?? ""
    );
  } catch (e) {
    return fail(label, "Yahoo Finance", "", e);
  }
}
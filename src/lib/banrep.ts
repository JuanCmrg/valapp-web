import https from "node:https";
import tls from "node:tls";
import { GEOTRUST_EV_RSA_CA_G2 } from "./certs";
import { cached, type CacheResult } from "./cache";
import type { BanrepDef } from "./catalog";
import type { ChartPoint } from "./types";

const BASE =
  "https://suameca.banrep.gov.co/estadisticas-economicas-back/rest/estadisticaEconomicaRestService";

const HEADERS = {
  Referer: "https://suameca.banrep.gov.co/estadisticas-economicas",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "es-CO,es;q=0.9",
  "User-Agent": "Mozilla/5.0 (compatible; VALAPP/2.0; +https://valapp-web.vercel.app)",
};

// fetch() no permite añadir certificados sin dependencias extra; https sí.
const agent = new https.Agent({
  keepAlive: true,
  ca: [...tls.rootCertificates, GEOTRUST_EV_RSA_CA_G2],
});

function getJson(url: string, timeoutMs: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { agent, headers: HEADERS }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("error", reject);
      res.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch {
          reject(new Error("La respuesta no es JSON"));
        }
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`Timeout (${timeoutMs} ms)`)));
    req.on("error", reject);
  });
}

export type Series = {
  points: ChartPoint[];
  sourceLabel: string;
};

const DAY_MS = 86_400_000;
// Suficiente para el rango más largo que ofrece la app; mantiene el valor en
// Redis muy por debajo del límite de 1 MB por petición.
const KEEP_MS = 10.5 * 365 * DAY_MS;

export function parseSeriesPoints(raw: unknown): ChartPoint[] {
  if (!Array.isArray(raw)) return [];
  const points = raw.filter(
    (p): p is ChartPoint => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])
  );
  return points.sort((a, b) => a[0] - b[0]);
}

export function monthlyVariation(points: ChartPoint[]): ChartPoint[] {
  const out: ChartPoint[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1][1];
    if (prev > 0) {
      out.push([points[i][0], Math.round((points[i][1] / prev - 1) * 10_000) / 100]);
    }
  }
  return out;
}

async function fetchBanrepPoints(def: BanrepDef): Promise<ChartPoint[]> {
  const data = await getJson(`${BASE}/consultaInformacionSerie?idSerie=${def.idSerie}`, 15_000);
  const serie = Array.isArray(data) ? data[0] : undefined;
  const points = parseSeriesPoints((serie as { data?: unknown } | undefined)?.data);
  if (points.length === 0) throw new Error(`Serie ${def.idSerie} sin datos`);
  return points;
}

/** Respaldo de la TRM: Datos Abiertos, publicado por la Superfinanciera. */
async function fetchTrmFromDatosAbiertos(): Promise<ChartPoint[]> {
  const url =
    "https://www.datos.gov.co/resource/32sa-8pi3.json?$select=valor,vigenciadesde&$order=vigenciadesde%20DESC&$limit=3000";
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
  if (!res.ok) throw new Error(`datos.gov.co HTTP ${res.status}`);
  const rows = (await res.json()) as { valor: string; vigenciadesde: string }[];
  const clean = parseSeriesPoints(
    rows.map((r): ChartPoint => [
      // Mismo instante que usa el Banrep: medianoche en Bogotá (UTC-5).
      Date.parse(`${r.vigenciadesde.slice(0, 10)}T05:00:00Z`),
      Number(r.valor),
    ])
  );
  if (clean.length === 0) throw new Error("datos.gov.co sin datos");
  return clean;
}

export function getSeries(def: BanrepDef): Promise<CacheResult<Series>> {
  const freshMs = def.periodicity === "daily" ? 30 * 60_000 : 3 * 60 * 60_000;
  return cached<Series>(
    `banrep:${def.id}`,
    { freshMs, staleMs: 120 * DAY_MS, readThrough: true },
    async () => {
      let points: ChartPoint[];
      let sourceLabel = "Banco de la República";
      try {
        points = await fetchBanrepPoints(def);
      } catch (e) {
        if (def.id !== "trm") throw e;
        points = await fetchTrmFromDatosAbiertos();
        sourceLabel = "Superfinanciera (datos.gov.co)";
      }
      if (def.derive === "monthlyVariation") points = monthlyVariation(points);
      const cutoff = Date.now() - KEEP_MS;
      return { sourceLabel, points: points.filter((p) => p[0] >= cutoff) };
    }
  );
}

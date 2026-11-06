import type { BanrepDef } from "./catalog";
import type { ChartPoint, Indicator } from "./types";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const bogotaFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" });

function bogotaYmd(at: number): { y: number; m: number; d: number } {
  const [y, m, d] = bogotaFmt.format(at).split("-").map(Number);
  return { y, m, d };
}

/** Primer instante (ms) del día siguiente al de `now` en Bogotá (UTC-5, sin DST). */
export function endOfBogotaDay(now: number): number {
  const { y, m, d } = bogotaYmd(now);
  return Date.UTC(y, m - 1, d + 1, 5);
}

/**
 * Hasta qué instante un punto cuenta como vigente. Las series diarias se fechan
 * por el día en que rigen, pero las anuales se fechan al final del período: el
 * salario mínimo de 2026 viene como 31/12/2026 y ya está vigente en noviembre.
 */
function vigencyLimit(now: number, periodicity: BanrepDef["periodicity"]): number {
  if (periodicity === "annual") return Date.UTC(bogotaYmd(now).y + 1, 0, 1, 5);
  return endOfBogotaDay(now);
}

export function periodLabel(ts: number, periodicity: BanrepDef["periodicity"]): string {
  const { y, m, d } = bogotaYmd(ts);
  switch (periodicity) {
    case "daily":
      return `${d} ${MESES[m - 1]} ${y}`;
    case "monthly":
      return `${MESES[m - 1]} ${y}`;
    case "quarterly":
      return `${Math.ceil(m / 3)}T ${y}`;
    case "annual":
      return String(y);
  }
}

const HISTORY_POINTS: Record<BanrepDef["periodicity"], number> = {
  daily: 30,
  monthly: 24,
  quarterly: 16,
  annual: 12,
};

/**
 * Construye la tarjeta a partir de la serie y la fecha actual. Es una función
 * pura de `now` para que una serie en cache siga mostrando el valor vigente
 * cuando cambia el día (TRM y UVR se publican por adelantado).
 */
export function indicatorFromSeries(
  def: BanrepDef,
  points: ChartPoint[],
  source: string,
  now: number
): Indicator {
  const limit = vigencyLimit(now, def.periodicity);
  let idx = -1;
  for (let i = 0; i < points.length; i++) {
    if (points[i][0] < limit) idx = i;
  }
  if (idx < 0) throw new Error("Sin valor vigente");

  const [ts, value] = points[idx];
  const previous = idx > 0 ? points[idx - 1][1] : undefined;
  const start = Math.max(0, idx - HISTORY_POINTS[def.periodicity] + 1);

  // Solo las series diarias publican por adelantado (TRM de mañana, UVR): se
  // incluye ese punto futuro para poder navegar hasta él.
  const upcoming = def.periodicity === "daily" ? points[idx + 1] : undefined;
  const history = points.slice(start, idx + (upcoming ? 2 : 1)).map(([t, v]) => ({
    value: v,
    referenceDate: periodLabel(t, def.periodicity),
    dateLabel: def.dateLabel,
  }));

  const change = previous === undefined ? undefined : value - previous;

  return {
    id: def.id,
    label: def.label,
    category: def.category,
    source,
    sourceUrl: `https://suameca.banrep.gov.co/estadisticas-economicas/informacionSerie/${def.idSerie}/`,
    description: def.description,
    value,
    unit: def.unit,
    decimals: def.decimals,
    ok: true,
    statusLabel: "Oficial",
    referenceDate: periodLabel(ts, def.periodicity),
    dateLabel: def.dateLabel,
    neutralChange: true,
    previousClose: previous,
    change,
    changeUnit: def.isPercent ? "pp" : undefined,
    changePercent:
      !def.isPercent && change !== undefined && previous ? (change / previous) * 100 : undefined,
    spark: points.slice(start, idx + 1).map((p) => p[1]),
    history,
    historyIndex: idx - start,
    next: upcoming
      ? { value: upcoming[1], referenceDate: periodLabel(upcoming[0], def.periodicity) }
      : undefined,
  };
}

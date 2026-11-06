import { NextResponse } from "next/server";
import { getSeries } from "@/lib/banrep";
import { defById, rangesFor } from "@/lib/catalog";
import type { ChartPoint, ChartResponse, RangeKey } from "@/lib/types";
import { getYahooChart } from "@/lib/yahoo";

const DAY_MS = 86_400_000;
const RANGE_DAYS: Partial<Record<RangeKey, number>> = {
  "1M": 31,
  "6M": 183,
  "1A": 366,
  "5A": 5 * 366,
  "10A": 10 * 366,
};
const MAX_POINTS = 500;

function thin(points: ChartPoint[]): ChartPoint[] {
  if (points.length <= MAX_POINTS) return points;
  const step = points.length / MAX_POINTS;
  const out: ChartPoint[] = [];
  for (let i = 0; i < MAX_POINTS - 1; i++) out.push(points[Math.floor(i * step)]);
  out.push(points[points.length - 1]);
  return out;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const def = defById(id);
  if (!def) return NextResponse.json({ error: "Indicador desconocido" }, { status: 404 });

  const range = new URL(req.url).searchParams.get("range") as RangeKey | null;
  if (!range || !rangesFor(def).includes(range)) {
    return NextResponse.json({ error: "Rango no válido" }, { status: 400 });
  }

  try {
    let points: ChartPoint[];
    if (def.provider === "yahoo") {
      points = await getYahooChart(def, range);
    } else {
      const { value } = await getSeries(def);
      const now = Date.now();
      const from = now - (RANGE_DAYS[range] ?? 366) * DAY_MS;
      // Las series anuales se fechan a fin de año: el año en curso ya rige.
      const to = def.periodicity === "annual" ? Infinity : now;
      points = value.points.filter((p) => p[0] >= from && p[0] <= to);
    }
    const body: ChartResponse = {
      id,
      range,
      points: thin(points),
      resolution: range === "1D" || range === "5D" ? "time" : "date",
    };
    return NextResponse.json(body, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (e) {
    console.error(`[chart] ${id}/${range}:`, e);
    return NextResponse.json({ error: "No se pudo cargar la serie" }, { status: 502 });
  }
}

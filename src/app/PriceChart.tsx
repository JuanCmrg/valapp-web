"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fmtNum, fmtSigned } from "@/lib/format";
import type { ChartPoint, ChartResponse, RangeKey } from "@/lib/types";

const HEIGHT = 260;
const MARGIN = { top: 12, right: 12, bottom: 24, left: 64 };

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || Math.abs(max) || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) {
    ticks.push(Number(v.toFixed(10)));
  }
  return ticks;
}

const TZ = "America/Bogota";

function formatX(ts: number, resolution: ChartResponse["resolution"], long: boolean, range: RangeKey) {
  if (resolution === "time") {
    return new Date(ts).toLocaleString("es-CO", {
      timeZone: TZ,
      ...(range === "5D" ? { day: "numeric", month: "short" } : {}),
      ...(range === "1D" || long ? { hour: "numeric", minute: "2-digit" } : {}),
    });
  }
  return new Date(ts).toLocaleDateString("es-CO", {
    timeZone: TZ,
    day: long || range === "1M" ? "numeric" : undefined,
    month: "short",
    year: long || range === "5A" || range === "10A" ? "numeric" : undefined,
  });
}

export function PriceChart({
  id,
  label,
  ranges,
  decimals,
}: {
  id: string;
  label: string;
  ranges: RangeKey[];
  decimals: number;
}) {
  const [range, setRange] = useState<RangeKey>(ranges.includes("1A") && ranges[0] !== "1D" ? "1A" : ranges[0]);
  const [data, setData] = useState<ChartResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const loading = !failed && (data?.id !== id || data?.range !== range);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/chart/${id}?range=${range}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<ChartResponse>;
      })
      .then((res) => {
        setData(res);
        setFailed(false);
        setHover(null);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setFailed(true);
      });
    return () => controller.abort();
  }, [id, range]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points: ChartPoint[] = useMemo(() => data?.points ?? [], [data]);

  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    const values = points.map((p) => p[1]);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const pad = (hi - lo || Math.abs(hi) * 0.01 || 1) * 0.08;
    const yMin = lo - pad;
    const yMax = hi + pad;
    const innerW = Math.max(10, width - MARGIN.left - MARGIN.right);
    const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;
    // Por índice y no por tiempo: así no quedan huecos en noches y fines de semana.
    const x = (i: number) => MARGIN.left + (i / (points.length - 1)) * innerW;
    const y = (v: number) => MARGIN.top + (1 - (v - yMin) / (yMax - yMin)) * innerH;
    const line = points
      .map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p[1]).toFixed(1)}`)
      .join(" ");
    const base = MARGIN.top + innerH;
    const area = `${line} L${x(points.length - 1).toFixed(1)} ${base} L${x(0).toFixed(1)} ${base} Z`;
    const ticks = niceTicks(yMin, yMax);
    const labelCount = width < 420 ? 3 : 5;
    const xLabels = Array.from({ length: labelCount }, (_, k) =>
      Math.round((k / (labelCount - 1)) * (points.length - 1))
    );
    return { x, y, line, area, ticks, xLabels, base, lo, hi };
  }, [points, width]);

  const first = points[0]?.[1];
  const last = points[points.length - 1]?.[1];
  const hovered = hover !== null ? points[hover] : null;
  const resolution = data?.resolution ?? "date";
  const tickDecimals = geometry
    ? Math.max(0, Math.min(decimals, geometry.hi - geometry.lo < 5 ? decimals : 0))
    : 0;

  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!geometry) return;
    const box = e.currentTarget.getBoundingClientRect();
    const innerW = width - MARGIN.left - MARGIN.right;
    const ratio = (e.clientX - box.left - MARGIN.left) / innerW;
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))));
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const delta = e.key === "ArrowLeft" ? -1 : 1;
    setHover((h) => Math.max(0, Math.min(points.length - 1, (h ?? points.length - 1) + delta)));
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Rango de tiempo" className="flex gap-1">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              aria-pressed={r === range}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                r === range ? "bg-accent-wash text-accent" : "text-ink-3 hover:text-ink"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowTable((s) => !s)}
          aria-pressed={showTable}
          className="text-xs text-ink-3 underline-offset-2 transition-colors hover:text-ink hover:underline"
        >
          {showTable ? "Ver gráfica" : "Ver tabla"}
        </button>
      </div>

      <div
        ref={boxRef}
        className={`relative mt-2 transition-opacity ${loading ? "opacity-50" : ""}`}
        style={{ minHeight: HEIGHT }}
      >
        {failed && (
          <p className="pt-24 text-center text-sm text-ink-2">
            No se pudo cargar el histórico. Prueba otro rango.
          </p>
        )}
        {!failed && !geometry && !loading && (
          <p className="pt-24 text-center text-sm text-ink-2">Sin datos para este rango.</p>
        )}

        {!failed && geometry && !showTable && (
          <>
            <svg
              width={width}
              height={HEIGHT}
              role="img"
              tabIndex={0}
              aria-label={`${label}: gráfica de ${range}, de ${fmtNum(first, decimals)} a ${fmtNum(last, decimals)}. Usa las flechas para recorrerla.`}
              onPointerMove={onPointer}
              onPointerDown={onPointer}
              onPointerLeave={() => setHover(null)}
              onKeyDown={onKey}
              onBlur={() => setHover(null)}
              className="block touch-pan-y rounded"
            >
              {geometry.ticks.map((t) => (
                <g key={t}>
                  <line
                    x1={MARGIN.left}
                    x2={width - MARGIN.right}
                    y1={geometry.y(t)}
                    y2={geometry.y(t)}
                    stroke="var(--line)"
                  />
                  <text
                    x={MARGIN.left - 8}
                    y={geometry.y(t) + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill="var(--ink-3)"
                    className="tabular-nums"
                  >
                    {fmtNum(t, tickDecimals)}
                  </text>
                </g>
              ))}
              {geometry.xLabels.map((i, k) => (
                <text
                  key={i}
                  x={geometry.x(i)}
                  y={HEIGHT - 6}
                  textAnchor={k === 0 ? "start" : k === geometry.xLabels.length - 1 ? "end" : "middle"}
                  fontSize="11"
                  fill="var(--ink-3)"
                >
                  {formatX(points[i][0], resolution, false, data?.range ?? range)}
                </text>
              ))}
              <path d={geometry.area} fill="var(--accent-wash)" />
              <path
                d={geometry.line}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {hover !== null && hovered && (
                <>
                  <line
                    x1={geometry.x(hover)}
                    x2={geometry.x(hover)}
                    y1={MARGIN.top}
                    y2={geometry.base}
                    stroke="var(--ink-3)"
                  />
                  <circle
                    cx={geometry.x(hover)}
                    cy={geometry.y(hovered[1])}
                    r="4"
                    fill="var(--accent)"
                    stroke="var(--surface)"
                    strokeWidth="2"
                  />
                </>
              )}
            </svg>
            {hover !== null && hovered && (
              <div
                className="pointer-events-none absolute top-1 rounded-lg border border-line-strong bg-surface-2 px-2.5 py-1.5 text-xs shadow-lg"
                style={
                  geometry.x(hover) > width / 2
                    ? { right: width - geometry.x(hover) + 10 }
                    : { left: geometry.x(hover) + 10 }
                }
              >
                <p className="font-semibold tabular-nums text-ink">{fmtNum(hovered[1], decimals)}</p>
                <p className="whitespace-nowrap text-ink-3">
                  {formatX(hovered[0], resolution, true, data?.range ?? range)}
                </p>
              </div>
            )}
          </>
        )}

        {!failed && geometry && showTable && (
          <div className="overflow-y-auto" style={{ maxHeight: HEIGHT }}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface text-xs text-ink-3">
                <tr>
                  <th className="py-1 text-left font-normal">Fecha</th>
                  <th className="py-1 text-right font-normal">Valor</th>
                </tr>
              </thead>
              <tbody>
                {[...points].reverse().map(([t, v]) => (
                  <tr key={t} className="border-t border-line">
                    <td className="py-1 text-ink-2">
                      {formatX(t, resolution, true, data?.range ?? range)}
                    </td>
                    <td className="py-1 text-right tabular-nums">{fmtNum(v, decimals)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {geometry && !failed && (
        <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <Stat label={`Mínimo (${range})`} value={fmtNum(geometry.lo, decimals)} />
          <Stat label={`Máximo (${range})`} value={fmtNum(geometry.hi, decimals)} />
          <Stat
            label={`Variación (${range})`}
            value={first ? `${fmtSigned(((last - first) / first) * 100)}%` : "—"}
          />
        </dl>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

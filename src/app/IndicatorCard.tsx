"use client";

import { useState } from "react";
import type { Indicator } from "@/lib/indicators";
import { ChangeLine } from "./ChangeLine";
import { Sparkline } from "./Sparkline";
import { FavoriteButton } from "./FavoriteButton";

export function IndicatorCard({
  indicator,
  isFavorite,
  onToggleFavorite,
}: {
  indicator: Indicator;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  // --- Navegación de historial (TRM y futuros indicadores BanRep) ---
  const hasHistory =
    indicator.history !== undefined &&
    indicator.history.length > 1 &&
    indicator.historyIndex !== undefined;

  const [navIdx, setNavIdx] = useState(indicator.historyIndex ?? 0);

  // Si hay historial, el punto mostrado sale de history[navIdx];
  // si no, usamos los valores normales del indicador.
  const point = hasHistory ? indicator.history![navIdx] : null;
  const displayValue = point ? point.value : indicator.value;
  const displayRefDate = point ? point.referenceDate : indicator.referenceDate;
  const displayDateLabel = point ? point.dateLabel : indicator.dateLabel;

  const atOldest = hasHistory && navIdx <= 0;
  const atNewest = hasHistory && navIdx >= indicator.history!.length - 1;
  const isToday = hasHistory && navIdx === indicator.historyIndex;
  const hasChange = indicator.changePercent !== undefined;
  const isUp = hasChange && indicator.changePercent! > 0;
  const isDown = hasChange && indicator.changePercent! < 0;

  const hasAh =
    indicator.afterHoursPrice !== undefined &&
    indicator.afterHoursChangePercent !== undefined;
  const hasPm =
    indicator.preMarketPrice !== undefined &&
    indicator.preMarketChangePercent !== undefined;

  let statusClasses: string;
  if (!indicator.ok) {
    statusClasses = "text-red-400 bg-red-400/10";
  } else if (indicator.stale) {
    statusClasses = "text-amber-300 bg-amber-300/10";
  } else if (indicator.statusLabel === "Oficial") {
    statusClasses = "text-sky-300 bg-sky-300/10";
  } else if (indicator.marketState === "closed") {
    statusClasses = "text-zinc-400 bg-zinc-400/10";
  } else if (indicator.marketState === "afterhours") {
    statusClasses = "text-amber-300 bg-amber-300/10";
  } else {
    statusClasses = "text-emerald-400 bg-emerald-400/10";
  }

  return (
    <article className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-zinc-500 uppercase tracking-wider truncate">
            {indicator.source}
          </p>
          <p className="text-lg font-medium mt-1 leading-tight text-balance break-words">
            {indicator.label}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-xs px-2 py-1 rounded-md ${statusClasses}`}
          >
            {indicator.ok ? indicator.statusLabel ?? "En vivo" : "Error"}
          </span>
          <FavoriteButton
            isFavorite={isFavorite}
            onToggle={onToggleFavorite}
          />
        </div>
      </div>

      {indicator.ok && displayValue !== null && displayValue !== undefined ? (
        <>
          <p className="text-3xl font-semibold tabular-nums">
            {displayValue.toLocaleString("es-CO", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="text-sm text-zinc-400 mt-1">
            {indicator.unit || "\u00A0"}
          </p>

          {hasHistory ? (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => setNavIdx((i) => Math.max(0, i - 1))}
                disabled={atOldest}
                aria-label="TRM anterior"
                className="text-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-1"
              >
                ◀
              </button>
              <p className="text-xs text-zinc-500 flex-1 text-center tabular-nums">
                {displayDateLabel ?? "Vigente"}: {displayRefDate}
                {!isToday && (
                  <span className="ml-1 text-zinc-600">
                    ({atNewest ? "futura" : "histórica"})
                  </span>
                )}
              </p>
              <button
                onClick={() =>
                  setNavIdx((i) =>
                    Math.min(indicator.history!.length - 1, i + 1)
                  )
                }
                disabled={atNewest}
                aria-label="TRM siguiente"
                className="text-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-1"
              >
                ▶
              </button>
            </div>
          ) : (
            displayRefDate && (
              <p className="text-xs text-zinc-500 mt-2">
                {displayDateLabel ?? "Vigente"}: {displayRefDate}
              </p>
            )
          )}

          {indicator.stale && indicator.staleAgeMs !== undefined && (
            <p className="text-xs text-amber-400/80 mt-2">
              Última lectura: hace{" "}
              {Math.round(indicator.staleAgeMs / 60000) < 1
                ? "menos de 1 min"
                : `${Math.round(indicator.staleAgeMs / 60000)} min`}
            </p>
          )}

          {hasChange && (
            <div className="mt-3">
              <ChangeLine
                change={indicator.change!}
                changePercent={indicator.changePercent!}
              />
            </div>
          )}

          {indicator.intradaySeries && indicator.intradaySeries.length >= 5 && (
            <div
              className={`mt-3 ${
                isUp
                  ? "text-emerald-400"
                  : isDown
                  ? "text-red-400"
                  : "text-zinc-400"
              }`}
            >
              <Sparkline data={indicator.intradaySeries} height={32} />
            </div>
          )}

          {(hasAh || hasPm) && (
            <div className="mt-3 pt-3 border-t border-zinc-800">
              {hasAh && (
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 shrink-0">
                    AH
                  </span>
                  <span className="text-sm font-medium tabular-nums text-zinc-300">
                    {indicator.afterHoursPrice!.toLocaleString("es-CO", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <ChangeLine
                    change={indicator.afterHoursChange!}
                    changePercent={indicator.afterHoursChangePercent!}
                    size="sm"
                  />
                </div>
              )}
              {hasPm && (
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 shrink-0">
                    PM
                  </span>
                  <span className="text-sm font-medium tabular-nums text-zinc-300">
                    {indicator.preMarketPrice!.toLocaleString("es-CO", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <ChangeLine
                    change={indicator.preMarketChange!}
                    changePercent={indicator.preMarketChangePercent!}
                    size="sm"
                  />
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-red-400">No se pudo cargar</p>
      )}
    </article>
  );
}
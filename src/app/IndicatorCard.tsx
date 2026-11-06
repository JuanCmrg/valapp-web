"use client";

import { useState } from "react";
import { directionOf, fmtAge, fmtNum, type Direction } from "@/lib/format";
import type { Indicator } from "@/lib/types";
import { ChangeLine } from "./ChangeLine";
import { FavoriteButton } from "./FavoriteButton";
import { Sparkline } from "./Sparkline";
import { StatusBadge } from "./StatusBadge";

export function IndicatorCard({
  indicator,
  isFavorite,
  flash,
  onToggleFavorite,
  onOpen,
}: {
  indicator: Indicator;
  isFavorite: boolean;
  flash?: Direction;
  onToggleFavorite: () => void;
  onOpen: () => void;
}) {
  const { history, historyIndex } = indicator;
  const hasHistory = !!history && history.length > 1 && historyIndex !== undefined;
  const [navIdx, setNavIdx] = useState(historyIndex ?? 0);

  const isCurrent = !hasHistory || navIdx === historyIndex;
  const point = hasHistory ? history[navIdx] : null;
  const displayValue = point ? point.value : indicator.value;
  const displayDate = point ? point.referenceDate : indicator.referenceDate;
  const displayDateLabel = point ? point.dateLabel : indicator.dateLabel;

  // Al navegar por el historial la variación es contra el punto anterior de la serie.
  let change = indicator.change;
  let changePercent = indicator.changePercent;
  if (!isCurrent && hasHistory) {
    const before = history[navIdx - 1];
    change = before && point ? point.value - before.value : undefined;
    changePercent =
      before && point && !indicator.changeUnit && before.value
        ? ((point.value - before.value) / before.value) * 100
        : undefined;
  }

  const direction =
    indicator.changePercent !== undefined
      ? directionOf(indicator.changePercent)
      : directionOf(indicator.change, indicator.decimals);
  const sparkColor =
    indicator.neutralChange || direction === "flat"
      ? "text-ink-3"
      : direction === "up"
      ? "text-up"
      : "text-down";

  const hasExtended =
    indicator.afterHoursPrice !== undefined || indicator.preMarketPrice !== undefined;

  return (
    <article className="relative flex flex-col rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-tight">
            <button
              onClick={onOpen}
              className="text-left after:absolute after:inset-0 after:rounded-2xl after:content-['']"
            >
              {indicator.label}
            </button>
          </h3>
          <p className="mt-0.5 truncate text-xs text-ink-3">{indicator.source}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <StatusBadge indicator={indicator} />
          <FavoriteButton
            isFavorite={isFavorite}
            label={indicator.label}
            onToggle={onToggleFavorite}
          />
        </div>
      </div>

      {indicator.ok && displayValue !== null ? (
        <>
          <div className="mt-3 flex items-baseline gap-1.5">
            <p
              key={displayValue}
              className={`-mx-1 rounded px-1 text-[26px] font-semibold leading-none tabular-nums tracking-tight ${
                flash === "up" ? "flash-up" : flash === "down" ? "flash-down" : ""
              }`}
            >
              {fmtNum(displayValue, indicator.decimals)}
            </p>
            <span className="text-xs text-ink-3">{indicator.unit}</span>
          </div>

          <div className="mt-1.5 min-h-5">
            <ChangeLine
              change={change}
              changePercent={changePercent}
              changeUnit={indicator.changeUnit}
              decimals={indicator.decimals}
              neutral={indicator.neutralChange}
            />
          </div>

          {indicator.spark && indicator.spark.length >= 2 && (
            <div className={`mt-2 ${sparkColor}`}>
              <Sparkline
                data={indicator.spark}
                reference={indicator.neutralChange ? undefined : indicator.previousClose}
              />
            </div>
          )}

          {hasHistory ? (
            <div className="relative z-10 mt-2 flex items-center gap-1 text-xs text-ink-3">
              <NavButton
                label={`${indicator.label}: dato anterior`}
                disabled={navIdx <= 0}
                onClick={() => setNavIdx((i) => Math.max(0, i - 1))}
              >
                ◀
              </NavButton>
              <p className="flex-1 text-center tabular-nums">
                {displayDateLabel}: {displayDate}
                {!isCurrent && (
                  <span className="text-warn">
                    {" "}
                    · {navIdx > historyIndex ? "próximo" : "histórico"}
                  </span>
                )}
              </p>
              <NavButton
                label={`${indicator.label}: dato siguiente`}
                disabled={navIdx >= history.length - 1}
                onClick={() => setNavIdx((i) => Math.min(history.length - 1, i + 1))}
              >
                ▶
              </NavButton>
            </div>
          ) : (
            displayDate && (
              <p className="mt-2 text-xs text-ink-3">
                {displayDateLabel}: {displayDate}
              </p>
            )
          )}

          {indicator.next && isCurrent && (
            <p className="mt-1 text-center text-xs text-ink-2">
              Próxima ({indicator.next.referenceDate}):{" "}
              <span className="font-medium tabular-nums">
                {fmtNum(indicator.next.value, indicator.decimals)}
              </span>
            </p>
          )}

          {indicator.stale && indicator.staleAgeMs !== undefined && (
            <p className="mt-2 text-xs text-warn">
              Fuente sin respuesta. Dato de hace {fmtAge(indicator.staleAgeMs)}.
            </p>
          )}

          {hasExtended && (
            <div className="mt-2.5 space-y-1 border-t border-line pt-2.5">
              {indicator.afterHoursPrice !== undefined && (
                <Extended
                  tag="Post"
                  title="Después del cierre"
                  price={indicator.afterHoursPrice}
                  change={indicator.afterHoursChange}
                  percent={indicator.afterHoursChangePercent}
                  decimals={indicator.decimals}
                />
              )}
              {indicator.preMarketPrice !== undefined && (
                <Extended
                  tag="Pre"
                  title="Antes de la apertura"
                  price={indicator.preMarketPrice}
                  change={indicator.preMarketChange}
                  percent={indicator.preMarketChangePercent}
                  decimals={indicator.decimals}
                />
              )}
            </div>
          )}
        </>
      ) : (
        <p className="mt-4 text-sm text-ink-2">La fuente no responde. Se reintentará sola.</p>
      )}
    </article>
  );
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded px-1.5 py-0.5 text-[10px] text-ink-3 transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Extended({
  tag,
  title,
  price,
  change,
  percent,
  decimals,
}: {
  tag: string;
  title: string;
  price: number;
  change?: number;
  percent?: number;
  decimals: number;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span title={title} className="w-7 shrink-0 text-[10px] uppercase tracking-wider text-ink-3">
        {tag}
      </span>
      <span className="text-sm font-medium tabular-nums text-ink-2">{fmtNum(price, decimals)}</span>
      <ChangeLine change={change} changePercent={percent} decimals={decimals} size="sm" />
    </div>
  );
}

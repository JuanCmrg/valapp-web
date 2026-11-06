"use client";

import { useEffect, useRef } from "react";
import { defById, rangesFor } from "@/lib/catalog";
import { fmtAge, fmtNum } from "@/lib/format";
import type { Indicator } from "@/lib/types";
import { ChangeLine } from "./ChangeLine";
import { FavoriteButton } from "./FavoriteButton";
import { PriceChart } from "./PriceChart";
import { StatusBadge } from "./StatusBadge";

export function DetailDialog({
  indicator,
  isFavorite,
  onToggleFavorite,
  onClose,
}: {
  indicator: Indicator;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const def = defById(indicator.id);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
      // El foco va al diálogo y no al primer botón, que parecería seleccionado.
      dialog.focus();
    }
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current.close();
      }}
      aria-labelledby="detail-title"
      tabIndex={-1}
      className="m-auto max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto rounded-2xl border border-line bg-surface p-0 text-ink"
    >
      <div className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="detail-title" className="text-lg font-semibold leading-tight">
                {indicator.label}
              </h2>
              <StatusBadge indicator={indicator} />
            </div>
            <p className="mt-0.5 text-xs text-ink-3">
              {indicator.category} · {indicator.source}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <FavoriteButton
              isFavorite={isFavorite}
              label={indicator.label}
              onToggle={onToggleFavorite}
            />
            <button
              onClick={() => ref.current?.close()}
              aria-label="Cerrar"
              className="-m-1 rounded-md p-1 text-ink-3 transition-colors hover:text-ink"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        {indicator.ok && indicator.value !== null ? (
          <div className="mt-4">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <p className="text-4xl font-semibold tabular-nums tracking-tight">
                {fmtNum(indicator.value, indicator.decimals)}
              </p>
              <span className="text-sm text-ink-3">{indicator.unit}</span>
            </div>
            <div className="mt-1">
              <ChangeLine
                change={indicator.change}
                changePercent={indicator.changePercent}
                changeUnit={indicator.changeUnit}
                decimals={indicator.decimals}
                neutral={indicator.neutralChange}
              />
            </div>
            {indicator.referenceDate && (
              <p className="mt-1 text-xs text-ink-3">
                {indicator.dateLabel}: {indicator.referenceDate}
              </p>
            )}
            {indicator.stale && indicator.staleAgeMs !== undefined && (
              <p className="mt-2 text-xs text-warn">
                La fuente no responde. Este dato es de hace {fmtAge(indicator.staleAgeMs)}.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-2">
            La fuente no responde en este momento.
            {indicator.error && <span className="block text-xs text-ink-3">{indicator.error}</span>}
          </p>
        )}

        {def && (
          <div className="mt-5">
            <PriceChart
              id={indicator.id}
              label={indicator.label}
              ranges={rangesFor(def)}
              decimals={indicator.decimals}
            />
          </div>
        )}

        {indicator.stats && indicator.stats.length > 0 && (
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm sm:grid-cols-3">
            {indicator.stats.map((s) => (
              <div key={s.label}>
                <dt className="text-xs text-ink-3">{s.label}</dt>
                <dd className="font-medium tabular-nums">{fmtNum(s.value, indicator.decimals)}</dd>
              </div>
            ))}
          </dl>
        )}

        {(indicator.description || indicator.sourceUrl) && (
          <div className="mt-4 border-t border-line pt-4 text-sm text-ink-2">
            {indicator.description && <p>{indicator.description}</p>}
            {indicator.sourceUrl && (
              <a
                href={indicator.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs text-accent underline-offset-2 hover:underline"
              >
                Ver en la fuente ↗
              </a>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}

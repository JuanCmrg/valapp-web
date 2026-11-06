"use client";

import { directionOf, fmtNum } from "@/lib/format";
import type { Indicator } from "@/lib/types";
import { ChangeLine } from "./ChangeLine";
import { FavoriteButton } from "./FavoriteButton";
import { Sparkline } from "./Sparkline";
import { StatusBadge } from "./StatusBadge";

export function IndicatorTable({
  indicators,
  favorites,
  onToggleFavorite,
  onOpen,
}: {
  indicators: Indicator[];
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <table className="w-full text-sm">
        <thead className="sr-only sm:not-sr-only">
          <tr className="border-b border-line text-left text-xs text-ink-3">
            <th className="w-10 px-3 py-2 font-normal">
              <span className="sr-only">Favorito</span>
            </th>
            <th className="py-2 pr-3 font-normal">Indicador</th>
            <th className="py-2 pr-3 text-right font-normal">Valor</th>
            <th className="py-2 pr-3 font-normal">Variación</th>
            <th className="hidden w-32 py-2 pr-3 font-normal md:table-cell">Tendencia</th>
            <th className="hidden py-2 pr-3 font-normal lg:table-cell">Estado</th>
          </tr>
        </thead>
        <tbody>
          {indicators.map((ind) => {
            const direction =
              ind.changePercent !== undefined
                ? directionOf(ind.changePercent)
                : directionOf(ind.change, ind.decimals);
            const color =
              ind.neutralChange || direction === "flat"
                ? "text-ink-3"
                : direction === "up"
                ? "text-up"
                : "text-down";
            return (
              <tr key={ind.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                <td className="px-3 py-2">
                  <FavoriteButton
                    isFavorite={favorites.has(ind.id)}
                    label={ind.label}
                    onToggle={() => onToggleFavorite(ind.id)}
                  />
                </td>
                <td className="py-2 pr-3">
                  <button onClick={() => onOpen(ind.id)} className="text-left font-medium">
                    {ind.label}
                  </button>
                  <span className="block text-xs text-ink-3">{ind.unit}</span>
                </td>
                <td className="py-2 pr-3 text-right font-medium tabular-nums">
                  {ind.value === null ? "—" : fmtNum(ind.value, ind.decimals)}
                </td>
                <td className="py-2 pr-3">
                  <ChangeLine
                    change={ind.change}
                    changePercent={ind.changePercent}
                    changeUnit={ind.changeUnit}
                    decimals={ind.decimals}
                    neutral={ind.neutralChange}
                    size="sm"
                  />
                </td>
                <td className={`hidden py-2 pr-3 md:table-cell ${color}`}>
                  {ind.spark && <Sparkline data={ind.spark} height={24} />}
                </td>
                <td className="hidden py-2 pr-3 lg:table-cell">
                  <StatusBadge indicator={ind} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

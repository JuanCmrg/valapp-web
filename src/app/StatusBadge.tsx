import type { Indicator } from "@/lib/types";

export function StatusBadge({ indicator }: { indicator: Indicator }) {
  let tone = "text-up bg-up-wash";
  if (!indicator.ok) tone = "text-down bg-down-wash";
  else if (indicator.stale) tone = "text-warn bg-warn-wash";
  else if (indicator.statusLabel === "Oficial") tone = "text-accent bg-accent-wash";
  else if (indicator.marketState === "closed") tone = "text-ink-2 bg-neutral-wash";
  else if (indicator.marketState === "afterhours") tone = "text-warn bg-warn-wash";

  return (
    <span className={`whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ${tone}`}>
      {indicator.ok ? indicator.statusLabel ?? "En vivo" : "Sin datos"}
    </span>
  );
}

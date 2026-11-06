import { directionOf, fmtSigned } from "@/lib/format";

/** Variación con flecha y signo, así el sentido nunca depende solo del color. */
export function ChangeLine({
  change,
  changePercent,
  changeUnit,
  decimals = 2,
  neutral = false,
  size = "md",
}: {
  change?: number;
  changePercent?: number;
  changeUnit?: "pp";
  decimals?: number;
  neutral?: boolean;
  size?: "md" | "sm";
}) {
  if (change === undefined && changePercent === undefined) return null;

  const direction =
    changePercent !== undefined ? directionOf(changePercent) : directionOf(change, decimals);
  const color =
    neutral || direction === "flat"
      ? "text-ink-2"
      : direction === "up"
      ? "text-up"
      : "text-down";
  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "—";
  const sm = size === "sm";

  return (
    <div className={`flex items-baseline gap-1.5 ${sm ? "text-xs" : "text-sm"} ${color}`}>
      <span aria-hidden className="text-[10px]">
        {arrow}
      </span>
      {changePercent !== undefined ? (
        <>
          <span className="font-medium tabular-nums">{fmtSigned(changePercent)}%</span>
          {change !== undefined && (
            <span className={`tabular-nums text-ink-3 ${sm ? "text-[10px]" : "text-xs"}`}>
              ({fmtSigned(change, decimals)})
            </span>
          )}
        </>
      ) : (
        <span className="font-medium tabular-nums">
          {fmtSigned(change!, decimals)}
          {changeUnit === "pp" ? " pp" : ""}
        </span>
      )}
    </div>
  );
}

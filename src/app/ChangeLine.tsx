export function ChangeLine({
  change,
  changePercent,
  size = "md",
}: {
  change: number;
  changePercent: number;
  size?: "md" | "sm";
}) {
  const isUp = changePercent > 0;
  const isDown = changePercent < 0;
  const color = isUp
    ? "text-emerald-400"
    : isDown
    ? "text-red-400"
    : "text-zinc-400";
  const arrow = isUp ? "▲" : isDown ? "▼" : "—";

  const isSm = size === "sm";

  return (
    <div
      className={`flex items-baseline gap-1.5 ${
        isSm ? "text-xs" : "text-sm"
      } ${color}`}
    >
      <span className={isSm ? "text-[10px]" : "text-xs"}>{arrow}</span>
      <span className="font-medium tabular-nums">
        {changePercent.toLocaleString("es-CO", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
          signDisplay: "always",
        })}
        %
      </span>
      <span
        className={`tabular-nums text-zinc-500 ${
          isSm ? "text-[10px]" : "text-xs"
        }`}
      >
        (
        {change.toLocaleString("es-CO", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
          signDisplay: "always",
        })}
        )
      </span>
    </div>
  );
}
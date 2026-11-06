export function fmtNum(value: number, decimals = 2): string {
  return value.toLocaleString("es-CO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Con signo; un valor que redondea a cero se muestra sin signo (nunca "-0,00"). */
export function fmtSigned(value: number, decimals = 2): string {
  const rounded = Number(value.toFixed(decimals));
  if (rounded === 0) return fmtNum(0, decimals);
  return value.toLocaleString("es-CO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: "always",
  });
}

export function fmtAge(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 1) return "menos de 1 min";
  if (min < 60) return `${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} días`;
}

export type Direction = "up" | "down" | "flat";

export function directionOf(value: number | undefined, decimals = 2): Direction {
  if (value === undefined) return "flat";
  const rounded = Number(value.toFixed(decimals));
  return rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
}

import type { MarketState } from "./types";

export type Exchange = "NYSE_INDEX" | "NYSE" | "BVC" | "TSE" | "B3" | "FOREX" | "CME" | "ICE_SOFTS" | "CRYPTO";

const EXCHANGE_BY_TICKER: Record<string, Exchange> = {
  "^GSPC": "NYSE_INDEX",
  "^IXIC": "NYSE_INDEX",
  "^NDX": "NYSE_INDEX",
  "^DJI": "NYSE_INDEX",
  "^VIX": "NYSE_INDEX",
  NVDA: "NYSE",
  TSLA: "NYSE",
  AMZN: "NYSE",
  JPM: "NYSE",
  MDLZ: "NYSE",
  BLK: "NYSE",
  "ECOPETROL.CL": "BVC",
  "PFCIBEST.CL": "BVC",
  "ICOLCAP.CL": "BVC",
  "^N225": "TSE",
  "^BVSP": "B3",
  "COP=X": "FOREX",
  "EURCOP=X": "FOREX",
  "DX-Y.NYB": "FOREX",
  "EURUSD=X": "FOREX",
  "CHF=X": "FOREX",
  "MXN=X": "FOREX",
  "BRL=X": "FOREX",
  "CHFCOP=X": "FOREX",
  "CL=F": "CME",
  "BZ=F": "CME",
  "GC=F": "CME",
  "SI=F": "CME",
  "KC=F": "ICE_SOFTS",
  "BTC-USD": "CRYPTO",
  "ETH-USD": "CRYPTO",
};

export function exchangeOf(ticker: string): Exchange | null {
  return EXCHANGE_BY_TICKER[ticker] ?? null;
}

function partsInZone(at: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(at);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const weekday = get("weekday");
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const minutes = hour * 60 + minute;
  const isWeekend = weekday === "Sat" || weekday === "Sun";
  const isFriday = weekday === "Fri";
  const isSunday = weekday === "Sun";

  return { weekday, minutes, isWeekend, isFriday, isSunday };
}

function within(min: number, start: number, end: number): boolean {
  return min >= start && min < end;
}

const m = (h: number, mm: number) => h * 60 + mm;

export function getMarketState(
  exchange: Exchange,
  at: Date = new Date()
): MarketState {
  switch (exchange) {
    case "NYSE_INDEX": {
      const { minutes, isWeekend } = partsInZone(at, "America/New_York");
      if (isWeekend) return "closed";
      if (within(minutes, m(9, 30), m(16, 0))) return "live";
      return "closed"; // sin AH ni pre-market
    }
    case "NYSE": {
      const { minutes, isWeekend } = partsInZone(at, "America/New_York");
      if (isWeekend) return "closed";
      if (within(minutes, m(9, 30), m(16, 0))) return "live";
      if (
        within(minutes, m(4, 0), m(9, 30)) ||
        within(minutes, m(16, 0), m(20, 0))
      )
        return "afterhours";
      return "closed";
    }
    case "BVC": {
      const { minutes, isWeekend } = partsInZone(at, "America/Bogota");
      if (isWeekend) return "closed";
      if (within(minutes, m(9, 30), m(15, 55))) return "live";
      return "closed";
    }
    case "B3": {
      const { minutes, isWeekend } = partsInZone(at, "America/Sao_Paulo");
      if (isWeekend) return "closed";
      if (within(minutes, m(10, 0), m(17, 30))) return "live";
      return "closed";
    }
    case "TSE": {
      const { minutes, isWeekend } = partsInZone(at, "Asia/Tokyo");
      if (isWeekend) return "closed";
      if (within(minutes, m(9, 0), m(11, 30))) return "live";
      if (within(minutes, m(12, 30), m(15, 30))) return "live";
      return "closed";
    }
    case "FOREX": {
      const ny = partsInZone(at, "America/New_York");
      if (ny.isFriday && ny.minutes >= m(17, 0)) return "closed";
      if (ny.weekday === "Sat") return "closed";
      if (ny.isSunday && ny.minutes < m(17, 0)) return "closed";
      return "live";
    }
    case "CME": {
      const ny = partsInZone(at, "America/New_York");
      if (ny.isFriday && ny.minutes >= m(17, 0)) return "closed";
      if (ny.weekday === "Sat") return "closed";
      if (ny.isSunday && ny.minutes < m(18, 0)) return "closed";
      if (within(ny.minutes, m(17, 0), m(18, 0))) return "closed";
      return "live";
    }
    case "ICE_SOFTS": {
      // Café arábica en ICE: 4:15 a. m. a 1:30 p. m. de Nueva York.
      const { minutes, isWeekend } = partsInZone(at, "America/New_York");
      if (isWeekend) return "closed";
      return within(minutes, m(4, 15), m(13, 30)) ? "live" : "closed";
    }
    case "CRYPTO":
      return "live";
  }
}

export type TradingPeriods = {
  pre?: { start: number; end: number };
  regular?: { start: number; end: number };
  post?: { start: number; end: number };
};

const inPeriod = (t: number, p?: { start: number; end: number }) =>
  !!p && t >= p.start && t < p.end;

/**
 * Cruza el horario fijo con la sesión que reporta Yahoo. Yahoo conoce los
 * festivos y el horario fijo conoce la pausa de Tokio, así que un mercado está
 * abierto únicamente si ambos coinciden.
 */
export function resolveMarketState(
  exchange: Exchange,
  periods: TradingPeriods | undefined,
  at: Date = new Date()
): MarketState {
  const scheduled = getMarketState(exchange, at);
  if (!periods?.regular || scheduled === "closed") return scheduled;
  // Forex, futuros y cripto operan casi continuo: Yahoo no los ajusta por sesión.
  if (exchange === "FOREX" || exchange === "CME" || exchange === "CRYPTO") return scheduled;

  const t = at.getTime() / 1000;
  if (scheduled === "live") return inPeriod(t, periods.regular) ? "live" : "closed";
  return inPeriod(t, periods.pre) || inPeriod(t, periods.post) ? "afterhours" : "closed";
}

export function statusLabelFor(state: MarketState): string {
  return state === "live"
    ? "En vivo"
    : state === "afterhours"
    ? "Extendido"
    : "Cerrado";
}
export type Exchange = "NYSE_INDEX" | "NYSE" | "BVC" | "TSE" | "B3" | "FOREX" | "CME";

export type MarketState = "live" | "afterhours" | "closed";

const EXCHANGE_BY_TICKER: Record<string, Exchange> = {
  "^GSPC": "NYSE_INDEX",
  "^IXIC": "NYSE_INDEX",
  "^NDX": "NYSE_INDEX",
  NVDA: "NYSE",
  TSLA: "NYSE",
  AMZN: "NYSE",
  JPM: "NYSE",
  MDLZ: "NYSE",
  BLK: "NYSE",
  "ECOPETROL.CL": "BVC",
  "PFCIBEST.CL": "BVC",
  "^N225": "TSE",
  "^BVSP": "B3",
  "COP=X": "FOREX",
  "EURUSD=X": "FOREX",
  "CHF=X": "FOREX",
  "MXN=X": "FOREX",
  "BRL=X": "FOREX",
  "CHFCOP=X": "FOREX",
  "CL=F": "CME",
  "BZ=F": "CME",
  "GC=F": "CME",
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
  }
}

export function statusLabelFor(state: MarketState): string {
  return state === "live"
    ? "En vivo"
    : state === "afterhours"
    ? "After-hours"
    : "Mercado cerrado";
}
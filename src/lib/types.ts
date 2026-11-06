export type MarketState = "live" | "afterhours" | "closed";

export type HistoryPoint = {
  value: number;
  referenceDate: string;
  dateLabel: string;
};

export type Indicator = {
  id: string;
  label: string;
  category: string;
  source: string;
  sourceUrl?: string;
  description?: string;
  value: number | null;
  unit: string;
  decimals: number;
  ok: boolean;
  error?: string;
  previousClose?: number;
  change?: number;
  changePercent?: number;
  /** "pp" = puntos porcentuales: la serie ya es un porcentaje. */
  changeUnit?: "pp";
  /** Subir no es "bueno" ni "malo" (p. ej. inflación): sin verde ni rojo. */
  neutralChange?: boolean;
  statusLabel?: string;
  marketState?: MarketState;
  referenceDate?: string;
  dateLabel?: string;
  stale?: boolean;
  staleAgeMs?: number;
  afterHoursPrice?: number;
  afterHoursChange?: number;
  afterHoursChangePercent?: number;
  preMarketPrice?: number;
  preMarketChange?: number;
  preMarketChangePercent?: number;
  /** Valores para la mini-gráfica de la tarjeta. */
  spark?: number[];
  history?: HistoryPoint[];
  historyIndex?: number;
  /** Valor ya publicado con vigencia futura (p. ej. la TRM de mañana). */
  next?: { value: number; referenceDate: string };
  stats?: { label: string; value: number }[];
};

export type Category = { title: string; indicators: Indicator[] };

export type Snapshot = { categories: Category[]; generatedAt: number };

export type ChartPoint = [timestampMs: number, value: number];

export type RangeKey = "1D" | "5D" | "1M" | "6M" | "1A" | "5A" | "10A";

export type ChartResponse = {
  id: string;
  range: RangeKey;
  points: ChartPoint[];
  /** "time" muestra hora en el eje; "date" solo fecha. */
  resolution: "time" | "date";
};

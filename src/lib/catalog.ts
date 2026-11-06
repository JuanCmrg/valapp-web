import type { RangeKey } from "./types";

export type BanrepDef = {
  provider: "banrep";
  id: string;
  label: string;
  category: string;
  idSerie: number;
  unit: string;
  decimals: number;
  periodicity: "daily" | "monthly" | "quarterly" | "annual";
  /** La serie es un porcentaje: los cambios se expresan en puntos porcentuales. */
  isPercent?: boolean;
  /** La serie publicada es un índice y mostramos su variación mensual. */
  derive?: "monthlyVariation";
  dateLabel: string;
  description: string;
};

export type YahooDef = {
  provider: "yahoo";
  id: string;
  label: string;
  category: string;
  symbol: string;
  decimals: number;
  /** Unidad a mostrar cuando la de Yahoo no es clara (p. ej. centavos). */
  unit?: string;
  description?: string;
};

export type IndicatorDef = BanrepDef | YahooDef;

export const CATEGORIES = [
  "Macro Colombia",
  "Índices",
  "Acciones",
  "Forex",
  "Commodities",
  "Cripto",
] as const;

const banrep = (d: Omit<BanrepDef, "provider" | "category">): BanrepDef => ({
  provider: "banrep",
  category: "Macro Colombia",
  ...d,
});

const yahoo = (
  category: string,
  id: string,
  symbol: string,
  label: string,
  decimals = 2,
  extra: Partial<YahooDef> = {}
): YahooDef => ({ provider: "yahoo", category, id, symbol, label, decimals, ...extra });

export const CATALOG: IndicatorDef[] = [
  banrep({
    id: "trm",
    label: "TRM",
    idSerie: 1,
    unit: "COP/USD",
    decimals: 2,
    periodicity: "daily",
    dateLabel: "Vigente",
    description:
      "Tasa Representativa del Mercado: promedio de las operaciones de compra y venta de dólares, certificado por la Superintendencia Financiera.",
  }),
  banrep({
    id: "tpm",
    label: "Tasa de política monetaria",
    idSerie: 59,
    unit: "% E.A.",
    decimals: 2,
    periodicity: "daily",
    isPercent: true,
    dateLabel: "Vigente",
    description: "Tasa de intervención definida por la Junta Directiva del Banco de la República.",
  }),
  banrep({
    id: "ibr",
    label: "IBR overnight",
    idSerie: 241,
    unit: "% nominal",
    decimals: 3,
    periodicity: "daily",
    isPercent: true,
    dateLabel: "Vigente",
    description:
      "Indicador Bancario de Referencia a un día, tasa de corto plazo del mercado interbancario.",
  }),
  banrep({
    id: "dtf",
    label: "DTF 90 días",
    idSerie: 70,
    unit: "% E.A.",
    decimals: 2,
    periodicity: "monthly",
    isPercent: true,
    dateLabel: "Período",
    description: "Tasa promedio de captación de los CDT a 90 días, dato mensual.",
  }),
  banrep({
    id: "uvr",
    label: "UVR",
    idSerie: 850,
    unit: "COP/UVR",
    decimals: 4,
    periodicity: "daily",
    dateLabel: "Vigente",
    description:
      "Unidad de Valor Real: refleja el poder adquisitivo con base en el IPC y se publica por adelantado.",
  }),
  banrep({
    id: "ipc12",
    label: "Inflación 12 meses",
    idSerie: 15270,
    unit: "% anual",
    decimals: 2,
    periodicity: "monthly",
    isPercent: true,
    dateLabel: "Período",
    description: "Variación anual del Índice de Precios al Consumidor. Fuente primaria: DANE.",
  }),
  banrep({
    id: "ipcMensual",
    label: "Inflación mensual",
    idSerie: 15000,
    unit: "% mensual",
    decimals: 2,
    periodicity: "monthly",
    isPercent: true,
    derive: "monthlyVariation",
    dateLabel: "Período",
    description:
      "Calculada a partir del índice IPC que publica el Banco de la República (dos decimales), por lo que puede diferir ±0,01 pp del boletín del DANE.",
  }),
  banrep({
    id: "metaInflacion",
    label: "Meta de inflación",
    idSerie: 853,
    unit: "%",
    decimals: 1,
    periodicity: "monthly",
    isPercent: true,
    dateLabel: "Período",
    description: "Objetivo de inflación fijado por la Junta Directiva del Banco de la República.",
  }),
  banrep({
    id: "desempleo",
    label: "Desempleo",
    idSerie: 15312,
    unit: "% nacional",
    decimals: 2,
    periodicity: "monthly",
    isPercent: true,
    dateLabel: "Período",
    description: "Tasa de desempleo total nacional. Fuente primaria: DANE.",
  }),
  banrep({
    id: "pib",
    label: "PIB, variación anual",
    idSerie: 15271,
    unit: "% anual",
    decimals: 2,
    periodicity: "quarterly",
    isPercent: true,
    dateLabel: "Período",
    description:
      "Crecimiento real del PIB trimestral frente al mismo trimestre del año anterior, base 2015, sin ajuste estacional.",
  }),
  banrep({
    id: "smmlv",
    label: "Salario mínimo",
    idSerie: 15416,
    unit: "COP/mes",
    decimals: 0,
    periodicity: "annual",
    dateLabel: "Año",
    description: "Salario mínimo mensual legal vigente, sin auxilio de transporte.",
  }),

  yahoo("Índices", "sp500", "^GSPC", "S&P 500"),
  yahoo("Índices", "nasdaq", "^IXIC", "NASDAQ Composite"),
  yahoo("Índices", "ndx", "^NDX", "NASDAQ 100"),
  yahoo("Índices", "dji", "^DJI", "Dow Jones"),
  yahoo("Índices", "vix", "^VIX", "VIX", 2, {
    unit: "puntos",
    description: "Volatilidad implícita del S&P 500, conocido como el índice del miedo.",
  }),
  yahoo("Índices", "ibov", "^BVSP", "IBOVESPA"),
  yahoo("Índices", "nikkei", "^N225", "NIKKEI"),

  yahoo("Acciones", "ecopetrol", "ECOPETROL.CL", "Ecopetrol"),
  yahoo("Acciones", "cibest", "PFCIBEST.CL", "PF Cibest"),
  yahoo("Acciones", "icolcap", "ICOLCAP.CL", "iShares COLCAP", 2, {
    description: "ETF que replica el índice COLCAP de la Bolsa de Valores de Colombia.",
  }),
  yahoo("Acciones", "nvda", "NVDA", "NVIDIA"),
  yahoo("Acciones", "tsla", "TSLA", "Tesla"),
  yahoo("Acciones", "amzn", "AMZN", "Amazon"),
  yahoo("Acciones", "jpm", "JPM", "JPMorgan"),
  yahoo("Acciones", "mdlz", "MDLZ", "Mondelez"),
  yahoo("Acciones", "blk", "BLK", "BlackRock"),

  yahoo("Forex", "usdcop", "COP=X", "USD/COP"),
  yahoo("Forex", "eurcop", "EURCOP=X", "EUR/COP"),
  yahoo("Forex", "chfcop", "CHFCOP=X", "CHF/COP"),
  yahoo("Forex", "eurusd", "EURUSD=X", "EUR/USD", 4),
  yahoo("Forex", "usdchf", "CHF=X", "USD/CHF", 4),
  yahoo("Forex", "usdmxn", "MXN=X", "USD/MXN", 4),
  yahoo("Forex", "usdbrl", "BRL=X", "USD/BRL", 4),
  yahoo("Forex", "dxy", "DX-Y.NYB", "Índice dólar (DXY)", 2, {
    unit: "puntos",
    description: "Valor del dólar frente a una canasta de seis divisas.",
  }),

  yahoo("Commodities", "wti", "CL=F", "Petróleo WTI", 2, { unit: "USD/barril" }),
  yahoo("Commodities", "brent", "BZ=F", "Petróleo Brent", 2, { unit: "USD/barril" }),
  yahoo("Commodities", "oro", "GC=F", "Oro", 2, { unit: "USD/onza" }),
  yahoo("Commodities", "plata", "SI=F", "Plata", 2, { unit: "USD/onza" }),
  yahoo("Commodities", "cafe", "KC=F", "Café arábica", 2, { unit: "¢USD/libra" }),

  yahoo("Cripto", "btc", "BTC-USD", "Bitcoin"),
  yahoo("Cripto", "eth", "ETH-USD", "Ethereum"),
];

export function defById(id: string): IndicatorDef | undefined {
  return CATALOG.find((d) => d.id === id);
}

export function defBySymbol(symbol: string): YahooDef | undefined {
  return CATALOG.find((d): d is YahooDef => d.provider === "yahoo" && d.symbol === symbol);
}

export function rangesFor(def: IndicatorDef): RangeKey[] {
  if (def.provider === "yahoo") return ["1D", "5D", "1M", "6M", "1A", "5A"];
  if (def.periodicity === "daily") return ["1M", "6M", "1A", "5A", "10A"];
  if (def.periodicity === "monthly") return ["1A", "5A", "10A"];
  return ["5A", "10A"]; // Trimestral y anual: en un año casi no hay puntos.
}

/** Favoritos guardados por versiones anteriores, que usaban la etiqueta. */
export const LEGACY_FAVORITE_IDS: Record<string, string> = {
  "IPC 12 meses": "ipc12",
  "IPC mensual": "ipcMensual",
  "PIB anual": "pib",
  SMMLV: "smmlv",
  TRM: "trm",
  UVR: "uvr",
  "S&P 500": "sp500",
  "NASDAQ Composite": "nasdaq",
  "NASDAQ 100": "ndx",
  IBOVESPA: "ibov",
  NIKKEI: "nikkei",
  ECOPETROL: "ecopetrol",
  PFCIBEST: "cibest",
  NVIDIA: "nvda",
  TESLA: "tsla",
  AMAZON: "amzn",
  JPMorgan: "jpm",
  Mondelez: "mdlz",
  BlackRock: "blk",
  "USD/COP": "usdcop",
  "EUR/USD": "eurusd",
  "USD/CHF": "usdchf",
  "USD/MXN": "usdmxn",
  "USD/BRL": "usdbrl",
  "CHF/COP": "chfcop",
  WTI: "wti",
  Brent: "brent",
  Oro: "oro",
};

/** Bolsas de la franja de sesiones y el activo que indica su estado. */
export const SESSIONS: { name: string; ref: string }[] = [
  { name: "BVC", ref: "ecopetrol" },
  { name: "Wall Street", ref: "sp500" },
  { name: "B3", ref: "ibov" },
  { name: "Tokio", ref: "nikkei" },
  { name: "Forex", ref: "usdcop" },
  { name: "Futuros", ref: "wti" },
];

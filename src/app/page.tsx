import {
  getTrm,
  getUvr,
  getSmmlv,
  getIpc12,
  getIpcMensual,
  getPib,
  getYahoo,
  type Indicator,
} from "@/lib/indicators";
import RefreshButton from "./RefreshButton";

type Category = { title: string; indicators: Indicator[] };

export default async function Home() {
  const [macro, indices, acciones, forex, commodities] = await Promise.all([
    Promise.all([
      getTrm(),
      getUvr(),
      getSmmlv(),
      getIpc12(),
      getIpcMensual(),
      getPib(),
    ]),
    Promise.all([
      getYahoo("^GSPC", "S&P 500"),
      getYahoo("^IXIC", "NASDAQ Composite"),
      getYahoo("^NDX", "NASDAQ 100"),
      getYahoo("^BVSP", "IBOVESPA"),
      getYahoo("^N225", "NIKKEI"),
    ]),
    Promise.all([
      getYahoo("ECOPETROL.CL", "ECOPETROL"),
      getYahoo("PFCIBEST.CL", "PFCIBEST"),
      getYahoo("NVDA", "NVIDIA"),
      getYahoo("TSLA", "TESLA"),
      getYahoo("AMZN", "AMAZON"),
      getYahoo("JPM", "JPMorgan"),
      getYahoo("MDLZ", "Mondelez"),
    ]),
    Promise.all([
      getYahoo("COP=X", "USD/COP"),
      getYahoo("EURUSD=X", "EUR/USD"),
      getYahoo("CHF=X", "USD/CHF"),
      getYahoo("MXN=X", "USD/MXN"),
      getYahoo("BRL=X", "USD/BRL"),
      getYahoo("CHFCOP=X", "CHF/COP"),
    ]),
    Promise.all([
      getYahoo("CL=F", "WTI"),
      getYahoo("BZ=F", "Brent"),
      getYahoo("GC=F", "Oro"),
    ]),
  ]);

  const categories: Category[] = [
    { title: "Macro Colombia", indicators: macro },
    { title: "Índices", indicators: indices },
    { title: "Acciones", indicators: acciones },
    { title: "Forex", indicators: forex },
    { title: "Commodities", indicators: commodities },
  ];

  const updated = new Date().toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">VALAPP</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Monitor de mercado · actualizado {updated}
            </p>
          </div>
          <RefreshButton />
        </header>

        <div className="space-y-10">
          {categories.map((cat) => (
            <section key={cat.title}>
              <h2 className="text-base font-medium text-zinc-400 uppercase tracking-widest mb-4">
                {cat.title}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {cat.indicators.map((ind) => (
                  <IndicatorCard key={ind.label} indicator={ind} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

function IndicatorCard({ indicator }: { indicator: Indicator }) {
  const hasChange = indicator.changePercent !== undefined;
  const isUp = hasChange && indicator.changePercent! > 0;
  const isDown = hasChange && indicator.changePercent! < 0;

  const changeColor = isUp
    ? "text-emerald-400"
    : isDown
    ? "text-red-400"
    : "text-zinc-400";

  const arrow = isUp ? "▲" : isDown ? "▼" : "—";

  let statusClasses: string;
  if (!indicator.ok) {
    statusClasses = "text-red-400 bg-red-400/10";
  } else if (indicator.statusLabel === "Oficial") {
    statusClasses = "text-sky-300 bg-sky-300/10";
  } else if (indicator.marketState === "closed") {
    statusClasses = "text-zinc-400 bg-zinc-400/10";
  } else if (indicator.marketState === "afterhours") {
    statusClasses = "text-amber-300 bg-amber-300/10";
  } else {
    statusClasses = "text-emerald-400 bg-emerald-400/10";
  }

  return (
    <article className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <p className="text-xs text-zinc-500 uppercase tracking-wider truncate">
            {indicator.source}
          </p>
          <p className="text-lg font-medium mt-1 truncate">{indicator.label}</p>
        </div>
        <span
          className={`shrink-0 text-xs px-2 py-1 rounded-md ${statusClasses}`}
        >
          {indicator.ok ? indicator.statusLabel ?? "En vivo" : "Error"}
        </span>
      </div>

      {indicator.ok && indicator.value !== null ? (
        <>
          <p className="text-3xl font-semibold tabular-nums">
            {indicator.value.toLocaleString("es-CO", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="text-sm text-zinc-400 mt-1">
            {indicator.unit || "\u00A0"}
          </p>

          {indicator.referenceDate && (
            <p className="text-xs text-zinc-500 mt-2">
              {indicator.dateLabel ?? "Vigente"}: {indicator.referenceDate}
            </p>
          )}

          {hasChange && (
            <div
              className={`flex items-baseline gap-1.5 mt-3 text-sm ${changeColor}`}
            >
              <span className="text-xs">{arrow}</span>
              <span className="font-medium tabular-nums">
                {indicator.changePercent!.toLocaleString("es-CO", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                  signDisplay: "always",
                })}
                %
              </span>
              {indicator.change !== undefined && (
                <span className="text-xs text-zinc-500 tabular-nums">
                  (
                  {indicator.change.toLocaleString("es-CO", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                    signDisplay: "always",
                  })}
                  )
                </span>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-red-400">No se pudo cargar</p>
      )}
    </article>
  );
}
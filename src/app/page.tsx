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
import { Dashboard } from "./Dashboard";

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
      getYahoo("BLK", "BlackRock"),
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

        <Dashboard categories={categories} />
      </div>
    </main>
  );
}
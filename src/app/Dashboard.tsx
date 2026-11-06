"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, LEGACY_FAVORITE_IDS, SESSIONS } from "@/lib/catalog";
import type { Direction } from "@/lib/format";
import type { Indicator, Snapshot } from "@/lib/types";
import { ChangeLine } from "./ChangeLine";
import { Converter } from "./Converter";
import { DetailDialog } from "./DetailDialog";
import { IndicatorCard } from "./IndicatorCard";
import { IndicatorTable } from "./IndicatorTable";
import { InstallButton } from "./InstallButton";
import { parseList, useLocalValue } from "./useLocalValue";

const REFRESH_MS = 60_000;
const FAVORITES_KEY = "valapp.favorites";
const COLLAPSED_KEY = "valapp.collapsed";
const VIEW_KEY = "valapp.view";
const THEME_KEY = "valapp.theme";

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function diffFlashes(prev: Snapshot, next: Snapshot): Record<string, Direction> {
  const before = new Map(prev.categories.flatMap((c) => c.indicators).map((i) => [i.id, i.value]));
  const out: Record<string, Direction> = {};
  for (const ind of next.categories.flatMap((c) => c.indicators)) {
    const old = before.get(ind.id);
    if (old != null && ind.value != null && ind.value !== old) {
      out[ind.id] = ind.value > old ? "up" : "down";
    }
  }
  return out;
}

export function Dashboard({ initial }: { initial: Snapshot }) {
  const [{ snapshot, flashes }, setData] = useState({
    snapshot: initial,
    flashes: {} as Record<string, Direction>,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [rawFav, setRawFav] = useLocalValue(FAVORITES_KEY);
  const [rawCollapsed, setRawCollapsed] = useLocalValue(COLLAPSED_KEY);
  const [rawView, setRawView] = useLocalValue(VIEW_KEY);

  const favorites = useMemo(
    () => new Set(parseList(rawFav).map((f) => LEGACY_FAVORITE_IDS[f] ?? f)),
    [rawFav]
  );
  const collapsed = useMemo(() => new Set(parseList(rawCollapsed)), [rawCollapsed]);
  const view = rawView === "table" ? "table" : "cards";

  const toggleIn = (set: Set<string>, value: string, write: (v: string) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    write(JSON.stringify([...next]));
  };
  const toggleFavorite = (id: string) => toggleIn(favorites, id, setRawFav);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/indicators");
      if (!res.ok) throw new Error(String(res.status));
      const next: Snapshot = await res.json();
      setData((d) => ({ snapshot: next, flashes: diffFlashes(d.snapshot, next) }));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Refresca solo con la pestaña visible; al volver, de inmediato si ya pasó el intervalo.
  const lastRun = useRef(initial.generatedAt);
  useEffect(() => {
    const run = () => {
      lastRun.current = Date.now();
      void refresh();
    };
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") run();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRun.current > REFRESH_MS) {
        run();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", run);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", run);
    };
  }, [refresh]);

  // Enlace directo a un indicador: /#trm abre su detalle.
  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.slice(1);
      setSelectedId(id || null);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  const open = (id: string) => {
    window.history.replaceState(null, "", `#${id}`);
    setSelectedId(id);
  };
  const close = () => {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    setSelectedId(null);
  };

  // "/" enfoca la búsqueda, como en muchos sitios.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "SELECT" && tag !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const all = useMemo(() => snapshot.categories.flatMap((c) => c.indicators), [snapshot]);
  const find = useCallback((id: string) => all.find((i) => i.id === id), [all]);
  const selected = selectedId ? find(selectedId) : undefined;

  const q = normalize(query.trim());
  const matches = useCallback(
    (ind: Indicator) => !q || normalize(`${ind.label} ${ind.category} ${ind.unit}`).includes(q),
    [q]
  );

  const movers = useMemo(() => {
    const quoted = all.filter(
      (i) => i.ok && !i.stale && !i.neutralChange && i.category !== "Forex" && i.changePercent !== undefined
    );
    const sorted = [...quoted].sort((a, b) => b.changePercent! - a.changePercent!);
    return {
      up: sorted.filter((i) => i.changePercent! > 0).slice(0, 3),
      down: sorted.filter((i) => i.changePercent! < 0).slice(-3).reverse(),
    };
  }, [all]);

  const sections = [
    { title: "Favoritos", indicators: all.filter((i) => favorites.has(i.id)) },
    ...snapshot.categories,
  ]
    .filter((s) => !category || s.title === category)
    .map((s) => ({ ...s, indicators: s.indicators.filter(matches) }))
    .filter((s) => s.indicators.length > 0);

  const updated = new Date(snapshot.generatedAt).toLocaleTimeString("es-CO", {
    timeZone: "America/Bogota",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
  const failures = all.filter((i) => !i.ok).length;

  return (
    <main className="min-h-screen px-4 pb-10 pt-5 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">VALAPP</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3" aria-live="polite">
              <span
                aria-hidden
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  loadFailed ? "bg-warn" : "pulse-dot bg-up"
                }`}
              />
              <span suppressHydrationWarning>
                {loadFailed ? "Sin conexión, última lectura" : "Actualizado"} {updated}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <InstallButton />
            <ThemeToggle />
            <button
              onClick={() => void refresh()}
              disabled={refreshing}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium transition-colors hover:border-line-strong disabled:opacity-60"
            >
              {refreshing ? "Actualizando…" : "Actualizar"}
            </button>
          </div>
        </header>

        <ul aria-label="Estado de los mercados" className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
          {SESSIONS.map((s) => {
            const state = find(s.ref)?.marketState;
            const open = state === "live";
            const extended = state === "afterhours";
            return (
              <li key={s.name} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full ${
                    open ? "bg-up" : extended ? "bg-warn" : "bg-ink-3"
                  }`}
                />
                <span className="text-ink-2">{s.name}</span>
                <span className="text-ink-3">
                  {open ? "abierto" : extended ? "extendido" : state === "closed" ? "cerrado" : "—"}
                </span>
              </li>
            );
          })}
        </ul>

        {failures > 0 && (
          <p className="mt-4 rounded-lg bg-warn-wash px-3 py-2 text-xs text-warn" role="status">
            {failures === 1 ? "Un indicador no respondió" : `${failures} indicadores no respondieron`}{" "}
            y se reintentará{failures === 1 ? "" : "n"} automáticamente.
          </p>
        )}

        <div className="-mx-4 mt-5 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-3">
          <Movers title="Mayores alzas" items={movers.up} onOpen={open} />
          <Movers title="Mayores bajas" items={movers.down} onOpen={open} />
          <div className="w-[85%] shrink-0 snap-center md:w-auto md:col-span-2 xl:col-span-1">
            <Converter find={find} />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar: TRM, oro, Ecopetrol…"
            aria-label="Buscar indicador"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm placeholder:text-ink-3 sm:w-64"
          />
          <div role="group" aria-label="Filtrar por categoría" className="flex flex-wrap gap-1">
            {[null, ...CATEGORIES].map((c) => (
              <button
                key={c ?? "todas"}
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  category === c ? "bg-accent-wash text-accent" : "text-ink-3 hover:text-ink"
                }`}
              >
                {c ?? "Todas"}
              </button>
            ))}
          </div>
          <div role="group" aria-label="Vista" className="ml-auto hidden gap-1 sm:flex">
            {(["cards", "table"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setRawView(v)}
                aria-pressed={view === v}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  view === v ? "bg-surface-2 text-ink" : "text-ink-3 hover:text-ink"
                }`}
              >
                {v === "cards" ? "Tarjetas" : "Tabla"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 space-y-7">
          {sections.map((section) => {
            const isCollapsed = collapsed.has(section.title) && !q;
            return (
              <section key={section.title}>
                <h2>
                  <button
                    onClick={() => toggleIn(collapsed, section.title, setRawCollapsed)}
                    aria-expanded={!isCollapsed}
                    className="group mb-3 flex items-center gap-2"
                  >
                    <span
                      aria-hidden
                      className={`inline-block text-[10px] text-ink-3 transition-transform ${
                        isCollapsed ? "" : "rotate-90"
                      }`}
                    >
                      ▶
                    </span>
                    <span className="text-sm font-semibold text-ink-2 group-hover:text-ink">
                      {section.title}
                    </span>
                    <span className="text-xs text-ink-3">{section.indicators.length}</span>
                  </button>
                </h2>
                {!isCollapsed &&
                  (view === "table" ? (
                    <IndicatorTable
                      indicators={section.indicators}
                      favorites={favorites}
                      onToggleFavorite={toggleFavorite}
                      onOpen={open}
                    />
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {section.indicators.map((ind) => (
                        <IndicatorCard
                          key={`${ind.id}-${ind.referenceDate ?? ""}`}
                          indicator={ind}
                          isFavorite={favorites.has(ind.id)}
                          flash={flashes[ind.id]}
                          onToggleFavorite={() => toggleFavorite(ind.id)}
                          onOpen={() => open(ind.id)}
                        />
                      ))}
                    </div>
                  ))}
              </section>
            );
          })}
          {sections.length === 0 && (
            <p className="py-10 text-center text-sm text-ink-2">
              No hay indicadores que coincidan con tu búsqueda.
            </p>
          )}
        </div>

        <footer className="mt-10 border-t border-line pt-4 text-xs leading-relaxed text-ink-3">
          Fuentes: Banco de la República, Superintendencia Financiera y Yahoo Finance. Las
          cotizaciones pueden tener hasta 15 minutos de retraso. Información de referencia, no
          constituye asesoría de inversión.
        </footer>
      </div>

      {selected && (
        <DetailDialog
          key={selected.id}
          indicator={selected}
          isFavorite={favorites.has(selected.id)}
          onToggleFavorite={() => toggleFavorite(selected.id)}
          onClose={close}
        />
      )}
    </main>
  );
}

function Movers({
  title,
  items,
  onOpen,
}: {
  title: string;
  items: Indicator[];
  onOpen: (id: string) => void;
}) {
  return (
    <section className="w-[85%] shrink-0 snap-center rounded-2xl border border-line bg-surface p-4 md:w-auto">
      <h2 className="text-sm font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-ink-3">Sin movimientos por ahora.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {items.map((i) => (
            <li key={i.id}>
              <button
                onClick={() => onOpen(i.id)}
                className="flex w-full items-center justify-between gap-3 py-1.5 text-left text-sm hover:text-accent"
              >
                <span className="truncate">{i.label}</span>
                <ChangeLine changePercent={i.changePercent} size="sm" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ThemeToggle() {
  const [stored, setStored] = useLocalValue(THEME_KEY);

  useEffect(() => {
    if (stored) document.documentElement.dataset.theme = stored;
  }, [stored]);

  const toggle = () => {
    const current = document.documentElement.dataset.theme;
    setStored(current === "light" ? "dark" : "light");
  };

  return (
    <button
      onClick={toggle}
      aria-label="Cambiar entre tema claro y oscuro"
      title="Cambiar tema"
      className="rounded-lg border border-line bg-surface p-2 text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
      </svg>
    </button>
  );
}

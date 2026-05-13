"use client";

import { useEffect, useState } from "react";
import type { Indicator } from "@/lib/indicators";
import { IndicatorCard } from "./IndicatorCard";

type Category = { title: string; indicators: Indicator[] };

const FAVORITES_KEY = "valapp.favorites";
const COLLAPSED_KEY = "valapp.collapsed";

function readSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed);
  } catch {}
  return new Set();
}

function writeSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {}
}

export function Dashboard({ categories }: { categories: Category[] }) {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFavorites(readSet(FAVORITES_KEY));
    setCollapsed(readSet(COLLAPSED_KEY));
    setHydrated(true);
  }, []);

  const toggleFavorite = (label: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      writeSet(FAVORITES_KEY, next);
      return next;
    });
  };

  const toggleCollapsed = (title: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      writeSet(COLLAPSED_KEY, next);
      return next;
    });
  };

  const allIndicators = categories.flatMap((c) => c.indicators);
  const favoriteIndicators = hydrated
    ? allIndicators.filter((ind) => favorites.has(ind.label))
    : [];

  return (
    <div className="space-y-10">
      {favoriteIndicators.length > 0 && (
        <CategorySection
          title="Favoritos"
          indicators={favoriteIndicators}
          isCollapsed={collapsed.has("Favoritos")}
          onToggleCollapse={() => toggleCollapsed("Favoritos")}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      )}

      {categories.map((cat) => (
        <CategorySection
          key={cat.title}
          title={cat.title}
          indicators={cat.indicators}
          isCollapsed={collapsed.has(cat.title)}
          onToggleCollapse={() => toggleCollapsed(cat.title)}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      ))}
    </div>
  );
}

function CategorySection({
  title,
  indicators,
  isCollapsed,
  onToggleCollapse,
  favorites,
  onToggleFavorite,
}: {
  title: string;
  indicators: Indicator[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  favorites: Set<string>;
  onToggleFavorite: (label: string) => void;
}) {
  return (
    <section>
      <button
        onClick={onToggleCollapse}
        className="flex items-center gap-2 mb-4 group"
      >
        <span
          className={`text-zinc-500 group-hover:text-zinc-300 transition-transform inline-block ${
            isCollapsed ? "" : "rotate-90"
          }`}
        >
          ▶
        </span>
        <h2 className="text-base font-medium text-zinc-400 group-hover:text-zinc-200 uppercase tracking-widest">
          {title}
        </h2>
        <span className="text-xs text-zinc-600 ml-1">
          {indicators.length}
        </span>
      </button>

      {!isCollapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {indicators.map((ind) => (
            <IndicatorCard
              key={`${title}-${ind.label}`}
              indicator={ind}
              isFavorite={favorites.has(ind.label)}
              onToggleFavorite={() => onToggleFavorite(ind.label)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
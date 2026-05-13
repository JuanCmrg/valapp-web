"use client";

type FavoriteButtonProps = {
  isFavorite: boolean;
  onToggle: () => void;
};

export function FavoriteButton({ isFavorite, onToggle }: FavoriteButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}
      className={`shrink-0 p-1 -m-1 rounded-md transition-colors ${
        isFavorite
          ? "text-amber-300 hover:text-amber-200"
          : "text-zinc-600 hover:text-zinc-400"
      }`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={isFavorite ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
}
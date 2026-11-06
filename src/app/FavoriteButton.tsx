"use client";

type FavoriteButtonProps = {
  isFavorite: boolean;
  onToggle: () => void;
  label: string;
};

export function FavoriteButton({ isFavorite, onToggle, label }: FavoriteButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={isFavorite}
      aria-label={`${isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}: ${label}`}
      className={`relative z-10 -m-1.5 shrink-0 rounded-md p-1.5 transition-colors ${
        isFavorite ? "text-warn" : "text-ink-3 hover:text-ink"
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
        aria-hidden
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
}

"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center">
      <div>
        <p className="text-2xl font-bold tracking-tight">VALAPP</p>
        <p className="mt-2 text-sm text-ink-2">No pudimos cargar el monitor en este momento.</p>
        <button
          onClick={reset}
          className="mt-5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}

export default function Loading() {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-6" aria-busy="true" aria-label="Cargando">
      <div className="mx-auto max-w-7xl">
        <p className="text-2xl font-bold tracking-tight">VALAPP</p>
        <p className="mt-1 text-sm text-ink-3">Cargando el mercado…</p>
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl border border-line bg-surface motion-reduce:animate-none"
            />
          ))}
        </div>
      </div>
    </main>
  );
}

export function Sparkline({
  data,
  height = 32,
  reference,
}: {
  data: number[];
  height?: number;
  /** Línea tenue de referencia, p. ej. el cierre anterior. */
  reference?: number;
}) {
  if (data.length < 2) return null;

  const width = 200;
  const pad = 3;
  const hasRef = reference !== undefined;
  const min = Math.min(...data, ...(hasRef ? [reference] : []));
  const max = Math.max(...data, ...(hasRef ? [reference] : []));
  const range = max - min || 1;
  const yOf = (v: number) => height - pad - ((v - min) / range) * (height - pad * 2);

  const points = data
    .map((v, i) => `${((i / (data.length - 1)) * width).toFixed(2)},${yOf(v).toFixed(2)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      className="block overflow-visible"
      aria-hidden
    >
      {hasRef && (
        <line
          x1={0}
          x2={width}
          y1={yOf(reference)}
          y2={yOf(reference)}
          stroke="var(--line-strong)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

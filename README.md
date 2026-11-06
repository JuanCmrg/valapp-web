# VALAPP

Monitor de mercado para Colombia: TRM, tasas, inflación y otros indicadores del
Banco de la República, junto con índices, acciones, forex, commodities y cripto.

Producción: https://valapp-web.vercel.app

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # pruebas unitarias
npm run typecheck
npm run lint
```

Sin `.env.local` la app funciona igual, con cache solo en memoria. Con las variables
`KV_REST_API_URL` y `KV_REST_API_TOKEN` (Upstash Redis) guarda además el respaldo
que se muestra cuando una fuente se cae.

## Cómo está organizado

- `src/lib/catalog.ts`: **lista de indicadores**. Agregar uno suele ser una sola línea
  (los símbolos de Yahoo también van en `marketHours.ts`).
- `src/lib/banrep.ts`: cliente del Banco de la República, con respaldo de la TRM en
  datos.gov.co.
- `src/lib/yahoo.ts`: cotizaciones y gráficas de Yahoo Finance.
- `src/lib/cache.ts`: memoria, luego Redis, luego la fuente; si la fuente falla, último
  dato conocido.
- `src/app/api/indicators` y `src/app/api/chart/[id]`: lo que consume el navegador.

## Certificado del Banrep

Desde septiembre de 2026 `suameca.banrep.gov.co` no envía su certificado intermedio.
Node.js no lo descarga por su cuenta y las peticiones fallan con
`UNABLE_TO_VERIFY_LEAF_SIGNATURE`, aunque en el navegador todo funcione. Por eso
`src/lib/certs.ts` incluye ese intermediario público como confianza adicional, sin
desactivar la verificación TLS. Vence en julio de 2030; si el Banrep cambia de
emisor con la cadena igual de incompleta, habrá que actualizarlo.

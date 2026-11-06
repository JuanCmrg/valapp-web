import { NextResponse } from "next/server";
import { defBySymbol } from "@/lib/catalog";
import { getIndicator } from "@/lib/indicators";

export async function GET(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  // Solo símbolos del catálogo: si no, esta ruta sería un proxy abierto a Yahoo
  // y cualquiera podría llenar la cache con claves arbitrarias.
  const def = defBySymbol(symbol);
  if (!def) return NextResponse.json({ error: "Símbolo no disponible" }, { status: 404 });
  return NextResponse.json(await getIndicator(def));
}

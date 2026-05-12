import { NextResponse } from "next/server";
import { getYahoo } from "@/lib/indicators";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  return NextResponse.json(await getYahoo(symbol, symbol));
}
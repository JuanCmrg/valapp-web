import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/indicators";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getSnapshot(), {
    headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=40" },
  });
}

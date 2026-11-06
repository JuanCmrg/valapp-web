import { NextResponse } from "next/server";
import { defById } from "@/lib/catalog";
import { getIndicator } from "@/lib/indicators";

export async function GET() {
  return NextResponse.json(await getIndicator(defById("trm")!));
}

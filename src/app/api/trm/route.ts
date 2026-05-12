import { NextResponse } from "next/server";
import { getTrm } from "@/lib/indicators";

export async function GET() {
  return NextResponse.json(await getTrm());
}
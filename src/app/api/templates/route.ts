import { NextResponse } from "next/server";
import { loadTemplates } from "@/lib/templates/load";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await loadTemplates());
}
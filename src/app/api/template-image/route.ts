import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { getTemplateById } from "@/lib/templates/load";
import { toErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const templateId = url.searchParams.get("templateId") ?? "";
  if (!templateId) return NextResponse.json({ error: "templateId mangler" }, { status: 400 });

  try {
    const t = await getTemplateById(templateId);
    if (t.type !== "hard") return NextResponse.json({ error: "template er ikke hard" }, { status: 400 });

    const abs = path.join(process.cwd(), t.baseScene.assetPath);
    const raw = await fs.readFile(abs);

    // gjør alltid om til PNG for sikker preview
    const png = await sharp(raw).png().toBuffer();

    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
        "X-Template-Id": t.id,
      },
    });
  } catch (e) {
    console.error("GET /api/template-image failed", e);
    return NextResponse.json({ error: toErrorMessage(e) }, { status: 500 });
  }
}
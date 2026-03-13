import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

import { toErrorMessage } from "@/lib/errors";
import { bufferToPngBuffer } from "@/lib/imageBuffers";
import { getTemplateById } from "@/lib/templates/load";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const templateId = url.searchParams.get("templateId")?.trim() ?? "";

    if (!templateId) {
      return NextResponse.json({ error: "templateId mangler" }, { status: 400 });
    }

    const template = await getTemplateById(templateId);

    if (template.type !== "hard") {
      return NextResponse.json({ error: "template er ikke hard" }, { status: 400 });
    }

    const absolutePath = path.join(process.cwd(), template.baseScene.assetPath);
    const fileBuffer = await fs.readFile(absolutePath);
    const pngBuffer = await bufferToPngBuffer(fileBuffer);

    return new Response(new Uint8Array(pngBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
        "X-Template-Id": template.id,
      },
    });
  } catch (error) {
    console.error("GET /api/template-image failed", error);
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}
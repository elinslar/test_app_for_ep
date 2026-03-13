import { NextResponse } from "next/server";

import { generateScene } from "@/azure-openai/images";
import { toErrorMessage } from "@/lib/errors";
import { getTemplateById } from "@/lib/templates/load";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { templateId?: string };
    const templateId = body.templateId?.trim();

    if (!templateId) {
      return NextResponse.json({ error: "templateId mangler" }, { status: 400 });
    }

    const template = await getTemplateById(templateId);

    if (template.type !== "soft") {
      return NextResponse.json({ error: "template er ikke soft" }, { status: 400 });
    }

    const buffer = await generateScene({
      prompt: template.scenePrompt,
      size: template.size ?? "1536x1024",
      quality: template.quality ?? "high",
    });

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "X-Template-Id": template.id,
      },
    });
  } catch (error) {
    console.error("POST /api/scene failed", error);
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}
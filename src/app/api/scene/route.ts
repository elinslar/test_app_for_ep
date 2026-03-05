import { NextResponse } from "next/server";
import { generateScene } from "@/lib/ai/azureImageClient";
import { getTemplateById } from "@/lib/templates/load";
import { toErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { templateId?: string };
    const templateId = body.templateId;

    if (!templateId) {
      return NextResponse.json({ error: "templateId mangler" }, { status: 400 });
    }

    const t = await getTemplateById(String(templateId));
    if (t.type !== "soft") {
      return NextResponse.json({ error: "template er ikke soft" }, { status: 400 });
    }

    const buf = await generateScene({
      prompt: t.scenePrompt,
      size: t.size ?? "1536x1024",
      quality: t.quality ?? "high",
    });

    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "X-Template-Id": t.id,
      },
    });
  } catch (e) {
    console.error("POST /api/scene failed", e);
    return NextResponse.json({ error: toErrorMessage(e) }, { status: 500 });
  }
}
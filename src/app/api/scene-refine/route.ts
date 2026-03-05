import { NextResponse } from "next/server";
import sharp from "sharp";
import { toErrorMessage } from "@/lib/errors";
import { refineSceneNoMask } from "@/lib/ai/azureImageClient";

export const runtime = "nodejs";

async function fileToPngBuffer(f: File): Promise<Buffer> {
  const buf = Buffer.from(await f.arrayBuffer());
  return sharp(buf).png().toBuffer();
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const instruction = String(form.get("instruction") ?? "").trim();
    const sceneFile = form.get("scene");

    if (!(sceneFile instanceof File)) {
      return NextResponse.json({ error: "scene (fil) mangler" }, { status: 400 });
    }
    if (!instruction) {
      return NextResponse.json({ error: "instruksjon mangler" }, { status: 400 });
    }

    const scenePng = await fileToPngBuffer(sceneFile);

    const prompt = [
      "You will receive a scene image.",
      "Modify the scene according to the instruction.",
      "Keep everything else unchanged as much as possible.",
      "Do not add any text or watermarks.",
      "",
      "INSTRUCTION:",
      instruction,
    ].join("\n");

    const out = await refineSceneNoMask({
      scenePng,
      prompt,
      inputFidelity: "high",
      quality: "high",
    });

    return new Response(new Uint8Array(out), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("POST /api/scene-refine failed", e);
    return NextResponse.json({ error: toErrorMessage(e) }, { status: 500 });
  }
}
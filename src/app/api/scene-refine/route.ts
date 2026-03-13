import { NextResponse } from "next/server";

import { refineSceneNoMask } from "@/azure-openai/images";
import { toErrorMessage } from "@/lib/errors";
import { fileToPngBuffer } from "@/lib/imageBuffers";
import { buildSceneRefinePrompt } from "@/lib/imagePrompts";

export const runtime = "nodejs";

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

    const output = await refineSceneNoMask({
      scenePng,
      prompt: buildSceneRefinePrompt(instruction),
      inputFidelity: "high",
      quality: "high",
    });

    return new Response(new Uint8Array(output), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("POST /api/scene-refine failed", error);
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}
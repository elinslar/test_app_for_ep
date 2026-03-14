import { NextResponse } from "next/server";

import { toErrorMessage } from "@/lib/errors";
import { fileToPngBuffer } from "@/lib/imageBuffers";
import { buildSceneRefinePrompt } from "@/lib/imagePrompts";
import { refineSceneWithModel } from "@/lib/imageGateway";
import { parseImageModelChoice } from "@/lib/imageModel";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const instruction = String(form.get("instruction") ?? "").trim();
    const sceneFile = form.get("scene");
    const modelChoice = parseImageModelChoice(form.get("modelChoice"));

    if (!(sceneFile instanceof File)) {
      return NextResponse.json({ error: "scene (fil) mangler" }, { status: 400 });
    }

    if (!instruction) {
      return NextResponse.json({ error: "instruksjon mangler" }, { status: 400 });
    }

    const scenePng = await fileToPngBuffer(sceneFile);

    const output = await refineSceneWithModel({
      modelChoice,
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
        "X-Model-Choice": modelChoice,
      },
    });
  } catch (error) {
    console.error("POST /api/scene-refine failed", error);
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}

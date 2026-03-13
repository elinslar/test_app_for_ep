import { NextResponse } from "next/server";

import { placeProductsNoMask } from "@/azure-openai/images";
import { toErrorMessage } from "@/lib/errors";
import { fileToPngBuffer } from "@/lib/imageBuffers";
import { buildPlacementPrompt } from "@/lib/imagePrompts";
import { parseOrderedRefs } from "@/lib/orderedRefs";
import { createUploadFileMap, resolveOrderedProducts } from "@/lib/productResolver";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const placementPrompt = String(form.get("placementPrompt") ?? "").trim();
    const variants = Math.max(1, Math.min(Number(form.get("variants") ?? "4"), 8));
    const sceneFile = form.get("scene");

    if (!(sceneFile instanceof File)) {
      return NextResponse.json({ error: "scene (fil) mangler" }, { status: 400 });
    }

    if (!placementPrompt) {
      return NextResponse.json({ error: "placementPrompt mangler" }, { status: 400 });
    }

    const orderedRefs = parseOrderedRefs(form.get("orderedRefs"));
    if (orderedRefs.length < 1 || orderedRefs.length > 4) {
      return NextResponse.json({ error: "Velg totalt 1–4 produkter" }, { status: 400 });
    }

    const uploadedFiles = form
      .getAll("products")
      .filter((value): value is File => value instanceof File);

    const scenePng = await fileToPngBuffer(sceneFile);
    const uploadByName = createUploadFileMap(uploadedFiles);
    const { productPngs, usedProductRefs } = await resolveOrderedProducts(
      orderedRefs,
      uploadByName
    );

    const resultBuffers = await placeProductsNoMask({
      scenePng,
      productPngs,
      prompt: buildPlacementPrompt(placementPrompt),
      variants,
      inputFidelity: "high",
      quality: "high",
    });

    const resultDataUrls = resultBuffers.map(
      (buffer) => `data:image/png;base64,${buffer.toString("base64")}`
    );

    return NextResponse.json({
      variants: resultDataUrls.length,
      resultDataUrls,
      usedProductRefs,
    });
  } catch (error) {
    console.error("POST /api/generate failed", error);
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}
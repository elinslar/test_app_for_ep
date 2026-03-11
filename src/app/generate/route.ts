import { NextResponse } from "next/server";
import sharp from "sharp";

import { placeProductsNoMask } from "@/azure-openai/images";
import { toErrorMessage } from "@/lib/errors";
import { getProductById } from "@/db/actions";
import { pickBestHref } from "@/lib/productImages";
import type { ProductRow } from "@/lib/types/product";

export const runtime = "nodejs";

type OrderedRef =
  | { kind: "productId"; value: string }
  | { kind: "upload"; value: string };

function dataUrlToBuffer(dataUrl: string): Buffer {
  const m = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!m) throw new Error("Invalid dataUrl");
  return Buffer.from(m[2], "base64");
}

async function fileToPngBuffer(f: File): Promise<Buffer> {
  const buf = Buffer.from(await f.arrayBuffer());
  // Azure edit forventer PNG/JPG inputs; vi normaliserer til PNG
  return sharp(buf).png().toBuffer();
}

async function downloadUrlToPngBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed downloading product image (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  return sharp(buf).png().toBuffer();
}

async function productIdToPngBuffer(
  productId: string
): Promise<{ png: Buffer; href: string }> {
  const rows = (await getProductById(productId)) as ProductRow[] | null | undefined;
  const p = rows?.[0];

  if (!p) throw new Error(`Fant ikke produktId=${productId}`);

  const href = pickBestHref(p.images);
  if (!href) throw new Error(`Fant ingen bestHref for produktId=${productId}`);

  return { png: await downloadUrlToPngBuffer(href), href };
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const sceneDataUrl = String(form.get("sceneDataUrl") ?? "");
    const placementPrompt = String(form.get("placementPrompt") ?? "");
    const variants = Math.max(1, Math.min(Number(form.get("variants") ?? "4"), 8));

    const orderedRefsRaw = String(form.get("orderedRefs") ?? "[]");
    let orderedRefs: OrderedRef[] = [];
    try {
      const parsed = JSON.parse(orderedRefsRaw);
      if (Array.isArray(parsed)) orderedRefs = parsed as OrderedRef[];
    } catch {
      orderedRefs = [];
    }

    const uploadedFiles = form.getAll("products").filter((x): x is File => x instanceof File);
    const uploadByName = new Map<string, File>();
    for (const f of uploadedFiles) uploadByName.set(f.name, f);

    if (!sceneDataUrl) return NextResponse.json({ error: "sceneDataUrl mangler" }, { status: 400 });
    if (!placementPrompt.trim()) return NextResponse.json({ error: "placementPrompt mangler" }, { status: 400 });

    // Hvis orderedRefs mangler (skal ikke skje), fall back til “alt som kom inn”
    if (orderedRefs.length === 0) {
      // all uploads first
      orderedRefs = uploadedFiles.map((f) => ({ kind: "upload", value: f.name } as const));
    }

    if (orderedRefs.length < 1 || orderedRefs.length > 4) {
      return NextResponse.json({ error: "Velg totalt 1–4 produkter" }, { status: 400 });
    }

    const sceneBuf = dataUrlToBuffer(sceneDataUrl);

    // Bygg produktlisten i NØYAKTIG rekkefølge (main først)
    const productPngs: Buffer[] = [];
    const usedProductRefs: Array<{ kind: "productId" | "upload"; value: string; href?: string }> = [];

    for (const ref of orderedRefs) {
      if (ref.kind === "productId") {
        const { png, href } = await productIdToPngBuffer(ref.value);
        productPngs.push(png);
        usedProductRefs.push({ kind: "productId", value: ref.value, href });
      } else {
        const f = uploadByName.get(ref.value);
        if (!f) throw new Error(`Upload not found for name=${ref.value}`);
        productPngs.push(await fileToPngBuffer(f));
        usedProductRefs.push({ kind: "upload", value: ref.value });
      }
    }

    const prompt = [
      "You will receive a scene image (first image) and 1-4 product reference images (next images).",
      "Place the products naturally into the scene according to the user instruction.",
      "Try to keep the original scene composition as unchanged as possible (especially for hard templates).",
      "The FIRST product reference is the main product. Prioritize placing it correctly (scale, perspective, position).",
      "Do NOT change product identity (labels, logos, shape, text).",
      "Use realistic scale and perspective. Add realistic contact shadows.",
      "Do not add new text or watermarks.",
      "",
      "PLASSERING",
      placementPrompt,
    ].join("\n");

    const resultBufs = await placeProductsNoMask({
      scenePng: sceneBuf,
      productPngs,
      prompt,
      variants,
      inputFidelity: "high",
      quality: "high",
    });

    const resultDataUrls = resultBufs.map((b) => `data:image/png;base64,${b.toString("base64")}`);

    return NextResponse.json({
      variants: resultDataUrls.length,
      resultDataUrls,
      usedProductRefs,
    });
  } catch (e) {
    console.error("POST /api/generate failed", e);
    return NextResponse.json({ error: toErrorMessage(e) }, { status: 500 });
  }
}
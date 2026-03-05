import { NextResponse } from "next/server";
import { getProductById } from "@/db/actions";
import { pickBestHref, parseImages } from "@/lib/productImages";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const productId = url.searchParams.get("productId") ?? "";
  if (!productId) return NextResponse.json({ error: "productId mangler" }, { status: 400 });

  const rows = await getProductById(productId);
  const p = rows?.[0];
  if (!p) return NextResponse.json({ found: false });

  return NextResponse.json({
    found: true,
    product: { productId: p.productId, name: p.name, categoryName: p.categoryName },
    bestHref: pickBestHref(p.images),
    images: parseImages(p.images),
  });
}
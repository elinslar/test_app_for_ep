import { NextResponse } from "next/server";

import { getProductById } from "@/db/actions";
import { pickBestHref, parseImages } from "@/lib/productImages";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const productId = url.searchParams.get("productId")?.trim() ?? "";

    if (!productId) {
      return NextResponse.json({ error: "productId mangler" }, { status: 400 });
    }

    const rows = await getProductById(productId);
    const product = rows[0];

    if (!product) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      product: {
        productId: product.productId,
        name: product.name,
        categoryName: product.categoryName,
      },
      bestHref: pickBestHref(product.images),
      images: parseImages(product.images),
    });
  } catch (error) {
    console.error("GET /api/products/by-id failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
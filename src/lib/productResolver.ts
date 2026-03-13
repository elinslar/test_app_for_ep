import "server-only";

import { getProductById } from "@/db/actions";
import { fileToPngBuffer, downloadUrlToPngBuffer } from "@/lib/imageBuffers";
import { pickBestHref } from "@/lib/productImages";
import type { OrderedRef } from "@/lib/orderedRefs";

export type UsedProductRef =
  | { kind: "productId"; value: string; href: string }
  | { kind: "upload"; value: string };

async function productIdToPngBuffer(
  productId: string
): Promise<{ png: Buffer; href: string }> {
  const rows = await getProductById(productId);
  const product = rows[0];

  if (!product) {
    throw new Error(`Fant ikke produktId=${productId}`);
  }

  const href = pickBestHref(product.images);
  if (!href) {
    throw new Error(`Fant ingen bilde-URL for produktId=${productId}`);
  }

  return {
    png: await downloadUrlToPngBuffer(href),
    href,
  };
}

export function createUploadFileMap(files: File[]): Map<string, File> {
  return new Map(files.map((file) => [file.name, file]));
}

export async function resolveOrderedProducts(
  orderedRefs: OrderedRef[],
  uploadByName: Map<string, File>
): Promise<{ productPngs: Buffer[]; usedProductRefs: UsedProductRef[] }> {
  const productPngs: Buffer[] = [];
  const usedProductRefs: UsedProductRef[] = [];

  for (const ref of orderedRefs) {
    if (ref.kind === "productId") {
      const resolved = await productIdToPngBuffer(ref.value);
      productPngs.push(resolved.png);
      usedProductRefs.push({
        kind: "productId",
        value: ref.value,
        href: resolved.href,
      });
      continue;
    }

    const upload = uploadByName.get(ref.value);
    if (!upload) {
      throw new Error(`Upload not found for name=${ref.value}`);
    }

    productPngs.push(await fileToPngBuffer(upload));
    usedProductRefs.push({
      kind: "upload",
      value: ref.value,
    });
  }

  return { productPngs, usedProductRefs };
}
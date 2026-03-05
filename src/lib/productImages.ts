import "server-only";

type ProductImage = {
  category?: string;
  width?: string;
  height?: string;
  href?: string;
};

const toInt = (s?: string) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

export function parseImages(images: unknown): ProductImage[] {
  if (Array.isArray(images)) return images as ProductImage[];
  if (typeof images === "string") {
    try {
      const parsed = JSON.parse(images);
      return Array.isArray(parsed) ? (parsed as ProductImage[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function pickBestHref(images: unknown): string | null {
  const arr = parseImages(images).filter((x) => typeof x.href === "string" && x.href.startsWith("http"));
  if (!arr.length) return null;

  const score = (x: ProductImage) => {
    const isMain = (x.category ?? "").toUpperCase() === "MAIN_IMAGE" ? 1 : 0;
    const area = toInt(x.width) * toInt(x.height);
    const vw800 = x.href?.includes("/vw800/") ? 1 : 0;
    return isMain * 1_000_000_000 + area * 1_000 + vw800 * 10;
  };

  arr.sort((a, b) => score(b) - score(a));
  return arr[0].href ?? null;
}
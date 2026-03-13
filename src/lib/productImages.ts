import "server-only";

type ProductImage = {
  category?: string;
  width?: string | number;
  height?: string | number;
  href?: string;
};

function toNumber(value: string | number | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseImages(images: unknown): ProductImage[] {
  if (Array.isArray(images)) {
    return images as ProductImage[];
  }

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
  const candidates = parseImages(images).filter(
    (image): image is ProductImage & { href: string } =>
      typeof image.href === "string" && image.href.startsWith("http")
  );

  if (candidates.length === 0) {
    return null;
  }

  const score = (image: ProductImage): number => {
    const isMainImage = (image.category ?? "").toUpperCase() === "MAIN_IMAGE" ? 1 : 0;
    const area = toNumber(image.width) * toNumber(image.height);
    const hasPreferredVariant = image.href?.includes("/vw800/") ? 1 : 0;

    return isMainImage * 1_000_000_000 + area * 1_000 + hasPreferredVariant * 10;
  };

  candidates.sort((a, b) => score(b) - score(a));
  return candidates[0]?.href ?? null;
}
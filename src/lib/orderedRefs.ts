export type OrderedRef =
  | { kind: "productId"; value: string }
  | { kind: "upload"; value: string };

export function parseOrderedRefs(raw: unknown): OrderedRef[] {
  if (typeof raw !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isOrderedRef);
  } catch {
    return [];
  }
}

function isOrderedRef(value: unknown): value is OrderedRef {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<OrderedRef>;
  return (
    (candidate.kind === "productId" || candidate.kind === "upload") &&
    typeof candidate.value === "string" &&
    candidate.value.trim().length > 0
  );
}
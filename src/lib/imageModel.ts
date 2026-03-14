export type ImageModelChoice = "gpt-image-1.5" | "flux-2-pro";

export const IMAGE_MODEL_OPTIONS: Array<{
  id: ImageModelChoice;
  label: string;
}> = [
  { id: "gpt-image-1.5", label: "GPT Image 1.5" },
  { id: "flux-2-pro", label: "FLUX.2 Pro" },
];

export function parseImageModelChoice(value: unknown): ImageModelChoice {
  return String(value ?? "").trim() === "flux-2-pro"
    ? "flux-2-pro"
    : "gpt-image-1.5";
}

export function isFluxModel(model: ImageModelChoice): boolean {
  return model === "flux-2-pro";
}

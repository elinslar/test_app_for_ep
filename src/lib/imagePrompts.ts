export function buildPlacementPrompt(placementInstruction: string): string {
  return [
    "You will receive a scene image (first image) and 1-4 product reference images (next images).",
    "Place the products naturally into the scene according to the user instruction.",
    "Try to keep the original scene composition as unchanged as possible.",
    "The FIRST product reference is the main product. Prioritize placing it correctly (scale, perspective, and position).",
    "Do NOT change product identity, labels, logos, shape, packaging text, or colors.",
    "Use realistic scale, perspective, and contact shadows.",
    "Do not add new text or watermarks.",
    "",
    "PLACEMENT INSTRUCTION:",
    placementInstruction.trim(),
  ].join("\n");
}

export function buildSceneRefinePrompt(instruction: string): string {
  return [
    "You will receive a scene image.",
    "Modify the scene according to the instruction.",
    "Keep everything else unchanged as much as possible.",
    "Do not add any text or watermarks.",
    "",
    "INSTRUCTION:",
    instruction.trim(),
  ].join("\n");
}
import "server-only";

import { buildFluxUrl, getFluxConfig } from "./client";

type FluxImageResponse =
  | {
      data?: Array<{
        b64_json?: string;
        url?: string;
      }>;
      image?: string;
      b64_json?: string;
      url?: string;
    }
  | Record<string, unknown>;

export type FluxGenerateArgs = {
  prompt: string;
  size?: "1024x1024" | "1536x1024" | "1024x1536";
};

export type FluxEditArgs = {
  prompt: string;
  images: Buffer[];
};

function sizeToWidthHeight(
  size: "1024x1024" | "1536x1024" | "1024x1536" = "1536x1024"
): { width: number; height: number } {
  const [width, height] = size.split("x").map(Number);
  return { width, height };
}

async function fluxResponseToBuffer(json: FluxImageResponse): Promise<Buffer> {
  if (Array.isArray(json.data) && json.data.length > 0) {
    const first = json.data[0];

    if (first?.b64_json) {
      return Buffer.from(first.b64_json, "base64");
    }

    if (first?.url) {
      const response = await fetch(first.url);
      if (!response.ok) {
        throw new Error(`Failed downloading FLUX image URL (${response.status})`);
      }
      return Buffer.from(await response.arrayBuffer());
    }
  }

  if (typeof json.b64_json === "string") {
    return Buffer.from(json.b64_json, "base64");
  }

  if (typeof json.image === "string") {
    if (json.image.startsWith("data:image/")) {
      const match = json.image.match(/^data:(.+);base64,(.+)$/);
      if (!match) {
        throw new Error("Invalid data URL returned from FLUX");
      }
      return Buffer.from(match[2], "base64");
    }

    return Buffer.from(json.image, "base64");
  }

  if (typeof json.url === "string") {
    const response = await fetch(json.url);
    if (!response.ok) {
      throw new Error(`Failed downloading FLUX image URL (${response.status})`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  throw new Error(
    `FLUX response did not contain image data: ${JSON.stringify(json).slice(0, 500)}`
  );
}

function buildFluxImageFields(images: Buffer[]): Record<string, string> {
  const fields: Record<string, string> = {};

  images.forEach((buffer, index) => {
    const key = index === 0 ? "input_image" : `input_image_${index + 1}`;
    fields[key] = buffer.toString("base64");
  });

  return fields;
}

async function callFlux(body: Record<string, unknown>): Promise<Buffer> {
  const { apiKey } = getFluxConfig();
  const url = buildFluxUrl();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`FLUX request failed (${response.status}): ${text}`);
  }

  let json: FluxImageResponse;
  try {
    json = JSON.parse(text) as FluxImageResponse;
  } catch {
    throw new Error(`FLUX returned non-JSON response: ${text.slice(0, 500)}`);
  }

  return fluxResponseToBuffer(json);
}

async function createFluxVariants(
  factory: (seed: number) => Record<string, unknown>,
  variants: number
): Promise<Buffer[]> {
  const count = Math.max(1, Math.min(variants, 8));
  const baseSeed = Math.floor(Math.random() * 1_000_000);

  const out: Buffer[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(await callFlux(factory(baseSeed + i)));
  }

  return out;
}

export async function generateSceneWithFlux(args: FluxGenerateArgs): Promise<Buffer> {
  const { model } = getFluxConfig();
  const { width, height } = sizeToWidthHeight(args.size ?? "1536x1024");

  return callFlux({
    model,
    prompt: args.prompt,
    width,
    height,
    n: 1,
    output_format: "png",
  });
}

export async function refineSceneWithFlux(args: FluxEditArgs): Promise<Buffer> {
  const { model } = getFluxConfig();

  return callFlux({
    model,
    prompt: args.prompt,
    n: 1,
    output_format: "png",
    ...buildFluxImageFields(args.images),
  });
}

export async function placeProductsWithFlux(args: {
  scenePng: Buffer;
  productPngs: Buffer[];
  prompt: string;
  variants: number;
}): Promise<Buffer[]> {
  const { model } = getFluxConfig();
  const images = [args.scenePng, ...args.productPngs];

  return createFluxVariants(
    (seed) => ({
      model,
      prompt: args.prompt,
      seed,
      n: 1,
      output_format: "png",
      ...buildFluxImageFields(images),
    }),
    args.variants
  );
}

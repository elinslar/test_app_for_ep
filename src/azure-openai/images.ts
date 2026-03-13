import "server-only";
import { toFile } from "openai";
import { getAzureImageClient } from "./client";

type AzureImageItem = {
  b64_json?: string;
  url?: string;
};

async function imageItemToBuffer(item: AzureImageItem): Promise<Buffer> {
  if (item.b64_json) {
    return Buffer.from(item.b64_json, "base64");
  }

  if (item.url) {
    const response = await fetch(item.url);

    if (!response.ok) {
      throw new Error(`Failed downloading Azure image URL (${response.status})`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  throw new Error("Azure image item missing b64_json/url");
}

async function responseDataToBuffers(data: AzureImageItem[] | undefined): Promise<Buffer[]> {
  if (!data || data.length === 0) {
    throw new Error("Azure image response was empty");
  }

  return Promise.all(data.map(imageItemToBuffer));
}

export async function generateScene(args: {
  prompt: string;
  size?: "1024x1024" | "1536x1024" | "1024x1536";
  quality?: "low" | "medium" | "high" | "auto";
}): Promise<Buffer> {
  const client = getAzureImageClient();

  const response = await client.images.generate({
    model: "",
    prompt: args.prompt,
    n: 1,
    size: args.size ?? "1536x1024",
    quality: args.quality ?? "high",
  });

  const buffers = await responseDataToBuffers(response.data as AzureImageItem[] | undefined);
  return buffers[0];
}

export async function placeProductsNoMask(args: {
  scenePng: Buffer;
  productPngs: Buffer[];
  prompt: string;
  variants: number;
  size?: "1024x1024" | "1536x1024" | "1024x1536";
  quality?: "low" | "medium" | "high" | "auto";
  inputFidelity?: "low" | "high";
}): Promise<Buffer[]> {
  const client = getAzureImageClient();

  const sceneFile = await toFile(args.scenePng, "scene.png", { type: "image/png" });
  const productFiles = await Promise.all(
    args.productPngs.map((buffer, index) =>
      toFile(buffer, `product_${index + 1}.png`, { type: "image/png" })
    )
  );

  const response = await client.images.edit({
    model: "",
    image: [sceneFile, ...productFiles],
    prompt: args.prompt,
    n: Math.max(1, Math.min(args.variants, 8)),
    size: args.size ?? "1536x1024",
    quality: args.quality ?? "high",
    input_fidelity: args.inputFidelity ?? "high",
  });

  return responseDataToBuffers(response.data as AzureImageItem[] | undefined);
}

export async function refineSceneNoMask(args: {
  scenePng: Buffer;
  prompt: string;
  size?: "1024x1024" | "1536x1024" | "1024x1536";
  quality?: "low" | "medium" | "high" | "auto";
  inputFidelity?: "low" | "high";
}): Promise<Buffer> {
  const client = getAzureImageClient();
  const sceneFile = await toFile(args.scenePng, "scene.png", { type: "image/png" });

  const response = await client.images.edit({
    model: "",
    image: [sceneFile],
    prompt: args.prompt,
    n: 1,
    size: args.size ?? "1536x1024",
    quality: args.quality ?? "high",
    input_fidelity: args.inputFidelity ?? "high",
  });

  const buffers = await responseDataToBuffers(response.data as AzureImageItem[] | undefined);
  return buffers[0];
}
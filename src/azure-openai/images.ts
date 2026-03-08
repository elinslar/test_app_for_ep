import "server-only";
import { toFile } from "openai";
import { getAzureImageClient } from "./client";

type ImageItem = { b64_json?: string; url?: string };

async function itemToBuffer(item: ImageItem): Promise<Buffer> {
  if (item.b64_json) {
    return Buffer.from(item.b64_json, "base64");
  }

  if (item.url) {
    const res = await fetch(item.url);
    if (!res.ok) {
      throw new Error(`Failed downloading image url (${res.status})`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  throw new Error("Azure image item missing b64_json/url");
}

async function dataToBuffers(data: ImageItem[] | undefined): Promise<Buffer[]> {
  if (!data || data.length === 0) {
    throw new Error("Azure image response: empty data");
  }

  return Promise.all(data.map(itemToBuffer));
}

export async function generateScene(args: {
  prompt: string;
  size?: "1024x1024" | "1536x1024" | "1024x1536";
  quality?: "low" | "medium" | "high" | "auto";
}): Promise<Buffer> {
  const client = getAzureImageClient();

  const rsp = await client.images.generate({
    model: "",
    prompt: args.prompt,
    n: 1,
    size: args.size ?? "1536x1024",
    quality: args.quality ?? "high",
  });

  const bufs = await dataToBuffers(rsp.data as ImageItem[] | undefined);
  return bufs[0];
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
    args.productPngs.map((b, i) =>
      toFile(b, `product_${i + 1}.png`, { type: "image/png" })
    )
  );

  const rsp = await client.images.edit({
    model: "",
    image: [sceneFile, ...productFiles],
    prompt: args.prompt,
    n: Math.max(1, Math.min(args.variants, 8)),
    size: args.size ?? "1536x1024",
    quality: args.quality ?? "high",
    input_fidelity: args.inputFidelity ?? "high",
  });

  return dataToBuffers(rsp.data as ImageItem[] | undefined);
}

export async function refineSceneNoMask(args: {
  scenePng: Buffer;
  prompt: string;
  quality?: "low" | "medium" | "high" | "auto";
  inputFidelity?: "low" | "high";
  size?: "1024x1024" | "1536x1024" | "1024x1536";
}): Promise<Buffer> {
  const client = getAzureImageClient();

  const sceneFile = await toFile(args.scenePng, "scene.png", { type: "image/png" });

  const rsp = await client.images.edit({
    model: "",
    image: [sceneFile],
    prompt: args.prompt,
    n: 1,
    size: args.size ?? "1536x1024",
    quality: args.quality ?? "high",
    input_fidelity: args.inputFidelity ?? "high",
  });

  const bufs = await dataToBuffers(rsp.data as ImageItem[] | undefined);
  return bufs[0];
}
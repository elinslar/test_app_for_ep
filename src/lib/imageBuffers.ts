import "server-only";
import sharp from "sharp";

export async function bufferToPngBuffer(input: Buffer): Promise<Buffer> {
  return sharp(input).png().toBuffer();
}

export async function fileToPngBuffer(file: File): Promise<Buffer> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return bufferToPngBuffer(buffer);
}

export async function downloadUrlToPngBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed downloading image (${response.status})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return bufferToPngBuffer(buffer);
}

export function dataUrlToBuffer(dataUrl: string): Buffer {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);

  if (!match) {
    throw new Error("Invalid data URL");
  }

  return Buffer.from(match[2], "base64");
}
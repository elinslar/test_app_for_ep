import "server-only";

import {
  generateScene as generateSceneWithAzureOpenAI,
  placeProductsNoMask as placeProductsWithAzureOpenAI,
  refineSceneNoMask as refineSceneWithAzureOpenAI,
} from "@/azure-openai/images";
import {
  generateSceneWithFlux,
  placeProductsWithFlux,
  refineSceneWithFlux,
} from "@/azure-bfl/images";
import type { ImageModelChoice } from "@/lib/imageModel";

export type GenerateSceneArgs = {
  modelChoice: ImageModelChoice;
  prompt: string;
  size?: "1024x1024" | "1536x1024" | "1024x1536";
  quality?: "low" | "medium" | "high" | "auto";
};

export type RefineSceneArgs = {
  modelChoice: ImageModelChoice;
  scenePng: Buffer;
  prompt: string;
  quality?: "low" | "medium" | "high" | "auto";
  inputFidelity?: "low" | "high";
  size?: "1024x1024" | "1536x1024" | "1024x1536";
};

export type PlaceProductsArgs = {
  modelChoice: ImageModelChoice;
  scenePng: Buffer;
  productPngs: Buffer[];
  prompt: string;
  variants: number;
  size?: "1024x1024" | "1536x1024" | "1024x1536";
  quality?: "low" | "medium" | "high" | "auto";
  inputFidelity?: "low" | "high";
};

export async function routeGenerateScene(args: GenerateSceneArgs): Promise<Buffer> {
  if (args.modelChoice === "flux-2-pro") {
    return generateSceneWithFlux({
      prompt: args.prompt,
      size: args.size,
    });
  }

  return generateSceneWithAzureOpenAI({
    prompt: args.prompt,
    size: args.size,
    quality: args.quality,
  });
}

export async function routeRefineScene(args: RefineSceneArgs): Promise<Buffer> {
  if (args.modelChoice === "flux-2-pro") {
    return refineSceneWithFlux({
      prompt: args.prompt,
      images: [args.scenePng],
    });
  }

  return refineSceneWithAzureOpenAI({
    scenePng: args.scenePng,
    prompt: args.prompt,
    quality: args.quality,
    inputFidelity: args.inputFidelity,
    size: args.size,
  });
}

export async function routePlaceProducts(args: PlaceProductsArgs): Promise<Buffer[]> {
  if (args.modelChoice === "flux-2-pro") {
    return placeProductsWithFlux({
      scenePng: args.scenePng,
      productPngs: args.productPngs,
      prompt: args.prompt,
      variants: args.variants,
    });
  }

  return placeProductsWithAzureOpenAI({
    scenePng: args.scenePng,
    productPngs: args.productPngs,
    prompt: args.prompt,
    variants: args.variants,
    size: args.size,
    quality: args.quality,
    inputFidelity: args.inputFidelity,
  });
}

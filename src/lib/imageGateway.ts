import "server-only";

import {
  routeGenerateScene,
  routePlaceProducts,
  routeRefineScene,
  type GenerateSceneArgs,
  type PlaceProductsArgs,
  type RefineSceneArgs,
} from "@/lib/modelRouter";

export async function generateSceneWithModel(
  args: GenerateSceneArgs
): Promise<Buffer> {
  return routeGenerateScene(args);
}

export async function refineSceneWithModel(
  args: RefineSceneArgs
): Promise<Buffer> {
  return routeRefineScene(args);
}

export async function placeProductsWithModel(
  args: PlaceProductsArgs
): Promise<Buffer[]> {
  return routePlaceProducts(args);
}

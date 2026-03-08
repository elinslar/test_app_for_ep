import "server-only";
import { AzureOpenAI } from "openai";

export function getAzureImageClient(): AzureOpenAI {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION;
  const deployment = process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT;

  if (!endpoint || !apiKey || !apiVersion || !deployment) {
    throw new Error(
      "Missing Azure OpenAI env vars (endpoint/apiKey/apiVersion/deployment)"
    );
  }

  return new AzureOpenAI({
    endpoint,
    apiKey,
    apiVersion,
    deployment,
  });
}
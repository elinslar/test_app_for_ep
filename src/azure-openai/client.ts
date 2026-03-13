import "server-only";
import { AzureOpenAI } from "openai";

let client: AzureOpenAI | null = null;

export function getAzureImageClient(): AzureOpenAI {
  if (client) {
    return client;
  }

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION;
  const deployment = process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT;

  if (!endpoint || !apiKey || !apiVersion || !deployment) {
    throw new Error(
      "Missing Azure OpenAI env vars (AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_API_VERSION, AZURE_OPENAI_IMAGE_DEPLOYMENT)."
    );
  }

  client = new AzureOpenAI({
    endpoint,
    apiKey,
    apiVersion,
    deployment,
  });

  return client;
}
import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import type { Template } from "./types";

const TEMPLATES_DIR = path.join(process.cwd(), "templates");

async function readTemplateFile(filename: string): Promise<Template> {
  const raw = await fs.readFile(path.join(TEMPLATES_DIR, filename), "utf-8");
  return JSON.parse(raw) as Template;
}

export async function loadTemplates(): Promise<Template[]> {
  const files = await fs.readdir(TEMPLATES_DIR);
  const jsonFiles = files.filter((file) => file.endsWith(".json")).sort();

  return Promise.all(jsonFiles.map(readTemplateFile));
}

export async function getTemplateById(id: string): Promise<Template> {
  const templates = await loadTemplates();
  const template = templates.find((item) => item.id === id);

  if (!template) {
    throw new Error(`Unknown template: ${id}`);
  }

  return template;
}
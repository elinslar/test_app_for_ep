import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import type { Template } from "./types";

const TEMPLATES_DIR = path.join(process.cwd(), "templates");

export async function loadTemplates(): Promise<Template[]> {
  const files = await fs.readdir(TEMPLATES_DIR);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  const out: Template[] = [];
  for (const f of jsonFiles) {
    const raw = await fs.readFile(path.join(TEMPLATES_DIR, f), "utf-8");
    out.push(JSON.parse(raw));
  }
  return out;
}

export async function getTemplateById(id: string): Promise<Template> {
  const all = await loadTemplates();
  const t = all.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown template: ${id}`);
  return t;
}
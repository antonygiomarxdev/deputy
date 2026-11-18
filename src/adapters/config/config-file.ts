import { readFile } from "node:fs/promises";
import { join } from "node:path";

export class ConfigError extends Error {}

/** `{}` when config.json is absent; an unreadable or non-object file throws ConfigError. */
export async function readConfigFile(dir: string): Promise<Readonly<Record<string, unknown>>> {
  let text: string;
  try {
    text = await readFile(join(dir, "config.json"), "utf8");
  } catch (e) {
    if (e instanceof Error && "code" in e && e.code === "ENOENT") return {};
    throw new ConfigError(`cannot read config.json: ${e instanceof Error ? e.message : String(e)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ConfigError("config.json is not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ConfigError("config.json must hold a JSON object");
  }
  return Object.fromEntries(Object.entries(parsed));
}

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env from the project root (no dependencies).
const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (line.trim().startsWith("#")) continue;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const [, k, raw] = m;
    if (process.env[k] === undefined) process.env[k] = raw.replace(/^["']|["']$/g, "");
  }
}

const env = (k: string, def?: string) => process.env[k] || def;
const req = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing ${k} in .env`);
  return v;
};

export const config = {
  root,
  dataDir: resolve(root, env("DEPUTY_DATA_DIR", "data")!),
  businessDir: resolve(root, env("DEPUTY_BUSINESS_DIR", "business")!),
  port: Number(env("DEPUTY_PORT", "8788")),
  host: env("DEPUTY_HOST", "127.0.0.1")!,
  provider: env("DEPUTY_PROVIDER", "dev")!,
  store: env("DEPUTY_STORE", "local")!,
  /** Owner numbers (comma separated). Their messages are trusted. */
  owners: (env("DEPUTY_OWNERS", "") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  /** Minutes Deputy stays quiet in a chat after the owner replies by hand from the app. */
  echoPauseMin: Number(env("DEPUTY_ECHO_PAUSE_MIN", "30")),
  /** Relay Claude Code permission prompts to the owner's WhatsApp. */
  permissionRelay: env("DEPUTY_PERMISSION_RELAY", "true") === "true",
  /** Language for the few messages Deputy itself writes to the owner: en | es. */
  lang: (env("DEPUTY_LANG", "en") === "es" ? "es" : "en") as "en" | "es",
  req,
  env,
};

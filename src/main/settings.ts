import { homedir } from "node:os";
import { join } from "node:path";

export interface Settings {
  port: number;
  dataDir: string;
  configDir: string;
  /** Test isolation hook: renames the OS secret-store service, so tests never read the developer's real secrets. */
  secretService: string | null;
  kapsoBaseUrl: string;
}

/** DEPUTY_PORT: a whole number from 1 to 65535, default 8788; anything else is refused, never turned into NaN. */
export function readSettings(): { ok: true; settings: Settings } | { ok: false; message: string } {
  const raw = process.env["DEPUTY_PORT"];
  const port = raw === undefined ? 8788 : /^[0-9]+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, message: `DEPUTY_PORT must be a whole number from 1 to 65535, got '${raw ?? ""}'` };
  }
  return {
    ok: true,
    settings: {
      port,
      dataDir: process.env["DEPUTY_DATA_DIR"] ?? "data",
      configDir: process.env["DEPUTY_CONFIG_DIR"] ?? join(homedir(), ".deputy"),
      secretService: process.env["DEPUTY_SECRET_SERVICE"] ?? null,
      kapsoBaseUrl: process.env["DEPUTY_KAPSO_BASE_URL"] ?? "https://api.kapso.ai",
    },
  };
}

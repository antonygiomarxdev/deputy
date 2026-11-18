import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface OsSecretStore {
  get(service: string, name: string): Promise<string | null>;
}

export interface SecretStore {
  get(name: string): Promise<{ value: string; where: "os_store" | "file" } | null>;
}

/** Reads only: the OS store first, then `<configDir>/secrets.env` (`name=value` lines). */
export function createSecretStore(d: { os: OsSecretStore; configDir: string }): SecretStore {
  return {
    async get(name) {
      try {
        const value = await d.os.get("deputy", name);
        if (value !== null) return { value, where: "os_store" };
      } catch {
        // an unavailable OS store falls through to the file
      }
      let text: string;
      try {
        text = await readFile(join(d.configDir, "secrets.env"), "utf8");
      } catch {
        return null;
      }
      for (const line of text.split(/\r?\n/)) {
        const eq = line.indexOf("=");
        if (eq > 0 && line.slice(0, eq).trim() === name) return { value: line.slice(eq + 1).trim(), where: "file" };
      }
      return null;
    },
  };
}

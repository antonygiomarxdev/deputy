import type { Store } from "../types.js";
import { createLocalStore } from "./local.js";
import { createSheetsStore } from "./sheets.js";

/** Store registry. To add one (Airtable, Notion, SQLite, …) implement `Store` and register it here. */
const registry: Record<string, () => Store> = {
  local: createLocalStore,
  sheets: createSheetsStore,
};

export function createStore(name: string): Store {
  const make = registry[name];
  if (!make) throw new Error(`Unknown store "${name}". Options: ${Object.keys(registry).join(", ")}`);
  return make();
}

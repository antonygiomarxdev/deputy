import type { Provider } from "../types.js";
import { createDevProvider } from "./dev.js";
import { createKapsoProvider } from "./kapso.js";
import { createMetaProvider } from "./meta.js";

/** Provider registry. To add one (Twilio, 360dialog, …) implement `Provider` and register it here. */
const registry: Record<string, () => Provider> = {
  meta: createMetaProvider,
  kapso: createKapsoProvider,
  dev: createDevProvider,
};

export function createProvider(name: string): Provider {
  const make = registry[name];
  if (!make) throw new Error(`Unknown provider "${name}". Options: ${Object.keys(registry).join(", ")}`);
  return make();
}

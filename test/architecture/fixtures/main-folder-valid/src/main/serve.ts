import { port } from "./settings";
import { SystemClock } from "../adapters/clock/system-clock";

export async function serve(): Promise<number> {
  return port === 0 || new SystemClock() === null ? 1 : 0;
}

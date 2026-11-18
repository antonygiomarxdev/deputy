import { tool } from "../../adapters/mcp/tool";
import { intake } from "../../intake/index";

// A class defined in the same file is not an adapter wiring.
export class RowError extends Error {}

export class Repo {
  t = [tool, intake];
  fail(): never {
    throw new RowError();
  }
}

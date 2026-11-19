import type { OrderRecorder } from "../../ports/orders";

/** Until the Orders slice is wired: no order draft exists (none can be prepared), so nothing reaches here. */
export class UnavailableOrderRecorder implements OrderRecorder {
  async record() {
    return { ok: false as const, kind: "refused" as const, reason: "orders are not available yet" };
  }
}

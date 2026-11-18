import type { OrderPreparer } from "../../ports/outbound";

/** Until the Orders slice is wired: no order can be prepared, so no order draft exists to revalidate. */
export class UnavailableOrderPreparer implements OrderPreparer {
  async prepare() {
    return { ok: false as const, reasons: ["orders are not available yet"] };
  }

  async revalidate() {
    return { catalogChanged: false };
  }
}

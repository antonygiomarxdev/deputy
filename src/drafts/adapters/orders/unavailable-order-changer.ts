import type { OrderChanger } from "../../ports/orders";

/** Until the Orders slice is wired: no order is known, so every command is refused as an unknown order. */
export class UnavailableOrderChanger implements OrderChanger {
  async chatOf() {
    return null;
  }

  async change() {
    return { ok: false as const, reason: "orders are not available yet" };
  }

  async delete() {
    return { ok: false as const, reason: "orders are not available yet" };
  }
}

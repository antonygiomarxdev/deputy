import type { ChatId } from "../../../shared/chat-id";
import type { OrderInput, OrderPreparer } from "../../ports/orders";

/** Accepts every order except one with a `fail` key, which it refuses with that key's value as the reason. */
export class FakeOrderPreparer implements OrderPreparer {
  catalogChanged = false;

  async prepare(_chat: ChatId, order: OrderInput) {
    if ("fail" in order) return { ok: false as const, reasons: [String(order.fail)] };
    const summary = typeof order.summary === "string" ? order.summary : "order";
    return { ok: true as const, payload: JSON.stringify(order), summary };
  }

  async revalidate(_payload: string) {
    return { catalogChanged: this.catalogChanged };
  }
}

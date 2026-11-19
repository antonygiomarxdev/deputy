import type { OrderChangeInput, OrderChanger } from "../../ports/orders";

/** Counts every call; `beforeAnswer` runs first, so a test can look at what was logged by then. */
export class FakeOrderChanger implements OrderChanger {
  readonly calls: { method: "change" | "delete"; orderRef: string; confirm?: boolean }[] = [];
  answer: { ok: true; detail: string } | { ok: false; reason: string } = { ok: true, detail: "done" };
  beforeAnswer: () => Promise<void> = async () => {};

  constructor(private readonly chats: Readonly<Record<string, string>> = {}) {}

  async chatOf(orderRef: string): Promise<string | null> {
    return this.chats[orderRef] ?? null;
  }

  async change(orderRef: string, _change: OrderChangeInput, _ownerWords: string) {
    this.calls.push({ method: "change", orderRef });
    await this.beforeAnswer();
    return this.answer;
  }

  async delete(orderRef: string, _ownerWords: string, confirm: boolean) {
    this.calls.push({ method: "delete", orderRef, confirm });
    await this.beforeAnswer();
    return confirm ? this.answer : { pending: `delete ${orderRef}? confirm to go ahead` };
  }
}

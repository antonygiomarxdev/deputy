import type { OrderRecorder } from "../../ports/outbound";

type Answer = Awaited<ReturnType<OrderRecorder["record"]>>;

/** Counts every call. Answers the queued answers first, then records: idempotent on the draft number. */
export class FakeOrderRecorder implements OrderRecorder {
  readonly calls: { draftNumber: number; payload: string; ownerWords: string }[] = [];
  readonly queue: Answer[] = [];

  async record(input: { draftNumber: number; payload: string; ownerWords: string }): Promise<Answer> {
    this.calls.push(input);
    return this.queue.shift() ?? { ok: true, orderId: `order-${input.draftNumber}` };
  }
}

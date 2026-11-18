type Handler<E> = (e: E) => void | Promise<void>;

/** Delivery is in-process and after commit (Intake ADR-006): `publish` never waits and never throws. */
export class InProcessEventBus<E> {
  private readonly handlers: Handler<E>[] = [];
  private readonly queue: E[] = [];
  private delivering = false;

  subscribe(h: Handler<E>): void {
    this.handlers.push(h);
  }

  publish(e: E): void {
    this.queue.push(e);
    if (this.delivering) return; // delivered after the outer handlers ran
    this.delivering = true;
    try {
      for (let next = this.queue.shift(); next !== undefined; next = this.queue.shift()) {
        for (const h of this.handlers) this.deliver(h, next);
      }
    } finally {
      this.delivering = false;
    }
  }

  private deliver(h: Handler<E>, e: E): void {
    try {
      const r = h(e);
      if (r instanceof Promise) r.catch((err) => console.error("deputy: event handler failed:", err));
    } catch (err) {
      console.error("deputy: event handler failed:", err);
    }
  }
}

export interface OwnerHooksDeps {
  /** Started only when the provider receives live deliveries. */
  listener: { start(): Promise<void>; stop(): Promise<void> };
  listens: boolean;
  scheduler: { start(): void; stop(): void };
  /** One line to the log when this process becomes the owner. */
  ownerLine: string;
  log(line: string): void;
}

/** What a process starts when it becomes the owner and stops when it loses the lease. */
export function ownerHooks(d: OwnerHooksDeps): { onAcquired(): Promise<void>; onLost(): Promise<void> } {
  return {
    async onAcquired() {
      if (d.listens) await d.listener.start();
      d.scheduler.start();
      d.log(d.ownerLine);
    },
    async onLost() {
      d.scheduler.stop();
      await d.listener.stop();
      d.log("deputy: lost the owner lease");
    },
  };
}

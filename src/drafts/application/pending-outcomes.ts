/** A send that went out whose `sent` entry could not be written yet. In memory only: a restart recovers the draft instead. */
export interface PendingOutcome {
  readonly draft: number;
  readonly sendId: string;
  readonly approvalEntryId: number;
}

export class PendingOutcomes {
  private items: PendingOutcome[] = [];

  add(item: PendingOutcome): void {
    this.items = [...this.items.filter((i) => i.sendId !== item.sendId), item];
  }

  list(): readonly PendingOutcome[] {
    return this.items;
  }

  remove(sendId: string): void {
    this.items = this.items.filter((i) => i.sendId !== sendId);
  }
}

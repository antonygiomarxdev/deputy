import type { Approval } from "../../domain/approval";
import type { ApprovalRepository } from "../../ports/store";

/** Born used, unique id and sendId, as the SQLite table enforces. */
export class InMemoryApprovals implements ApprovalRepository {
  private rows: Approval[] = [];

  constructor(private readonly isOrderDraft: (number: number) => boolean) {}

  save(): Approval[] {
    return [...this.rows];
  }

  restore(rows: Approval[]): void {
    this.rows = rows;
  }

  async insert(a: Approval): Promise<void> {
    if (a.usedAt === null) throw new Error("an approval is born used");
    if (this.rows.some((r) => r.id === a.id || r.sendId === a.sendId)) throw new Error("approval id or send id already exists");
    this.rows.push(a);
  }

  async void(draft: number, reason: string, at: number): Promise<void> {
    this.rows = this.rows.map((r) => (r.draftNumber === draft && r.voidedAt === null ? { ...r, voidedAt: at, voidReason: reason } : r));
  }

  async scrubOrderDraft(draft: number): Promise<void> {
    if (!this.isOrderDraft(draft)) return;
    this.rows = this.rows.map((r) => (r.draftNumber === draft ? { ...r, text: "deleted", ownerWords: "deleted", textHash: "deleted" } : r));
  }

  async forDraft(draft: number): Promise<Approval[]> {
    return this.rows.filter((r) => r.draftNumber === draft);
  }
}

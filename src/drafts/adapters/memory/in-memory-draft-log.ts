import type { ChatId } from "../../../shared/chat-id";
import { LogUnavailable } from "../../domain/errors";
import type { LogEntry, NewLogEntry } from "../../domain/log-entry";
import type { DraftLogRepository } from "../../ports/log";

const SCRUBBABLE_KINDS = new Set(["order_command", "order_deleted"]);

/** Append-only, with the refusals of the SQLite CHECKs and triggers (SPEC-04 Task 2). */
export class InMemoryDraftLog implements DraftLogRepository {
  private entries: LogEntry[] = [];

  async append(batch: NewLogEntry[]): Promise<number[]> {
    for (const e of batch) {
      if (e.draft === null && e.orderRef === null) throw new LogUnavailable("entry has no draft number and no order reference");
      if (e.draftKind === "order" && (e.proposedText !== null || e.finalText !== null)) {
        throw new LogUnavailable("order draft entries carry no text");
      }
    }
    return batch.map((e) => {
      const id = this.entries.length + 1;
      this.entries.push({ ...e, id, scrubbed: false });
      return id;
    });
  }

  async page(f: { chat?: ChatId; before?: number; after?: number; limit: number }): Promise<LogEntry[]> {
    const rows = this.entries.filter((e) => f.chat === undefined || e.chat === f.chat);
    const { after } = f;
    if (after !== undefined) return rows.filter((e) => e.id > after).slice(0, f.limit);
    return rows
      .filter((e) => f.before === undefined || e.id < f.before)
      .reverse()
      .slice(0, f.limit);
  }

  async sentWithApproval(): Promise<{ sent: LogEntry; approval: LogEntry | null }[]> {
    return this.entries
      .filter((e) => e.kind === "sent")
      .map((sent) => ({ sent, approval: this.entries.find((e) => e.id === sent.approvalEntryId) ?? null }));
  }

  // shortcut: needs the draft states, which live in the drafts store of SPEC-01 Task 2; that task fills this in.
  async stuckDrafts(): Promise<{ draft: number; chat: string; state: "sending" | "unknown"; since: string }[]> {
    return [];
  }

  async scrubOrder(orderId: string, draftNumber: number | null): Promise<number> {
    let count = 0;
    this.entries = this.entries.map((e) => {
      const ofOrder = e.orderRef === orderId || (draftNumber !== null && e.draft === draftNumber);
      if (e.scrubbed || !ofOrder || !(e.draftKind === "order" || SCRUBBABLE_KINDS.has(e.kind))) return e;
      count++;
      return { ...e, scrubbed: true, ownerWords: e.ownerWords === null ? null : "deleted" };
    });
    return count;
  }

  async approvalEntryIdFor(sendId: string): Promise<number | null> {
    return this.entries.find((e) => e.kind === "approved" && e.sendId === sendId)?.id ?? null;
  }

  async hasOrderDeleted(orderRef: string): Promise<boolean> {
    return this.entries.some((e) => e.kind === "order_deleted" && e.orderRef === orderRef);
  }
}

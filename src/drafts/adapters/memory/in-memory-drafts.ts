import type { ChatId } from "../../../shared/chat-id";
import type { OwnerLease } from "../../../shared/owner-lease";
import { Draft, OPEN_STATES, type DraftKind, type DraftNumber, type DraftSnapshot } from "../../domain/draft";
import { LeaseLost, LogUnavailable, StaleDraft } from "../../domain/errors";
import type { LogEntry, NewLogEntry } from "../../domain/log-entry";
import { toIso } from "../../domain/time";
import type { DraftLogRepository } from "../../ports/log";
import type { Approval } from "../../domain/approval";
import type { ApprovalRepository, DraftRepository, Transaction, UnitOfWork } from "../../ports/outbound";

const SCRUBBABLE_KINDS = new Set(["order_command", "order_deleted"]);

/** Append-only, with the refusals of the SQLite CHECKs and triggers (SPEC-04 Task 2). */
export class InMemoryDraftLog implements DraftLogRepository {
  private entries: LogEntry[] = [];

  constructor(private readonly drafts: () => Iterable<DraftSnapshot>) {}

  /** For the store's rollback. */
  save(): LogEntry[] {
    return [...this.entries];
  }

  restore(entries: LogEntry[]): void {
    this.entries = entries;
  }

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

  /** Reply drafts in "sending" or "unknown" with no `sent` entry; `since` is the time of the latest `sending` entry. */
  async stuckDrafts(): Promise<{ draft: number; chat: string; state: "sending" | "unknown"; since: string }[]> {
    const stuck: { draft: number; chat: string; state: "sending" | "unknown"; since: string }[] = [];
    for (const d of this.drafts()) {
      if (d.kind !== "reply" || (d.state !== "sending" && d.state !== "unknown")) continue;
      const mine = this.entries.filter((e) => e.draft === d.number);
      if (mine.some((e) => e.kind === "sent")) continue;
      const lastSending = mine.filter((e) => e.kind === "sending").at(-1);
      stuck.push({ draft: d.number, chat: d.chat, state: d.state, since: toIso(lastSending?.at ?? d.madeAt) });
    }
    return stuck;
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

/** Born used, unique id and sendId, as the SQLite table enforces. */
class InMemoryApprovals implements ApprovalRepository {
  private rows: Approval[] = [];

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

  async forDraft(draft: number): Promise<Approval[]> {
    return this.rows.filter((r) => r.draftNumber === draft);
  }
}

/** One shared store: drafts, approvals, the number counter and the log. */
export class InMemoryDrafts {
  private drafts = new Map<DraftNumber, DraftSnapshot>();
  private counter = 0;
  private tail: Promise<unknown> = Promise.resolve();
  readonly log = new InMemoryDraftLog(() => this.drafts.values());
  private readonly approvals = new InMemoryApprovals();
  readonly unitOfWork: UnitOfWork;

  constructor(private readonly lease: OwnerLease) {
    this.unitOfWork = {
      run: (work, options) => this.serialize(() => this.transact(work, options)),
      read: (work) => this.serialize(() => work({ drafts: this.repository() })),
    };
  }

  private serialize<T>(job: () => Promise<T>): Promise<T> {
    const result = this.tail.then(job);
    this.tail = result.catch(() => undefined);
    return result;
  }

  private async transact<T>(
    work: (tx: Transaction) => Promise<T>,
    options?: { requireLease?: boolean },
  ): Promise<T> {
    if ((options?.requireLease ?? true) && !(await this.lease.isOwner())) throw new LeaseLost();
    const before = { drafts: new Map(this.drafts), counter: this.counter, log: this.log.save(), approvals: this.approvals.save() };
    try {
      const result = await work({ drafts: this.repository(), approvals: this.approvals, log: this.log });
      // the SQLite foreign key on replaced_by is deferred to commit; so is this check
      for (const d of this.drafts.values()) {
        if (d.replacedBy !== null && !this.drafts.has(d.replacedBy)) {
          throw new Error(`draft ${d.number} was replaced by ${d.replacedBy}, which does not exist`);
        }
      }
      return result;
    } catch (e) {
      this.drafts = before.drafts;
      this.counter = before.counter;
      this.log.restore(before.log);
      this.approvals.restore(before.approvals);
      throw e;
    }
  }

  private repository(): DraftRepository {
    const open = (chat: ChatId, kind: DraftKind) =>
      [...this.drafts.values()].find((s) => s.chat === chat && s.kind === kind && OPEN_STATES.includes(s.state));
    return {
      nextNumber: async () => ++this.counter,
      get: async (number) => {
        const s = this.drafts.get(number);
        return s ? Draft.rehydrate(s) : null;
      },
      openFor: async (chat, kind) => {
        const s = open(chat, kind);
        return s ? Draft.rehydrate(s) : null;
      },
      listOpen: async (filter) =>
        [...this.drafts.values()]
          .filter((s) => OPEN_STATES.includes(s.state) && (filter?.chat === undefined || s.chat === filter.chat))
          .sort((a, b) => a.number - b.number)
          .map((s) => Draft.rehydrate(s)),
      hasDraftText: async (normalized) =>
        [...this.drafts.values()].some((s) => s.proposedNorm === normalized || s.currentNorm === normalized),
      save: async (draft) => {
        const s = draft.snapshot();
        const stored = this.drafts.get(s.number);
        if (stored && stored.revision !== s.revision) throw new StaleDraft(s.number);
        const clash = open(s.chat, s.kind);
        // the SQLite adapter's unique open index: one open draft per (chat, kind)
        if (OPEN_STATES.includes(s.state) && clash && clash.number !== s.number) {
          throw new Error(`chat ${s.chat} already has an open ${s.kind} draft`);
        }
        this.drafts.set(s.number, { ...s, approval: null, revision: stored ? stored.revision + 1 : s.revision });
      },
    };
  }
}

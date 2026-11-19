import type { OwnerLease } from "../../../shared/owner-lease";
import { createSerializer } from "../../../adapters/serial";
import { Draft, OPEN_STATES, type DraftKind, type DraftNumber, type DraftSnapshot } from "../../domain/draft";
import { LeaseLost, StaleDraft } from "../../domain/errors";
import type { ChatId } from "../../../shared/chat-id";
import type { DraftRepository, Transaction, UnitOfWork } from "../../ports/store";
import { InMemoryApprovals } from "./in-memory-approvals";
import { InMemoryDraftLog } from "./in-memory-draft-log";

/** One shared store: drafts, approvals, the number counter and the log. */
export class InMemoryDrafts {
  private drafts = new Map<DraftNumber, DraftSnapshot>();
  private counter = 0;
  private readonly serialize = createSerializer();
  readonly log = new InMemoryDraftLog(() => this.drafts.values());
  private readonly approvals = new InMemoryApprovals((n) => this.drafts.get(n)?.kind === "order");
  readonly unitOfWork: UnitOfWork;

  constructor(private readonly lease: OwnerLease) {
    this.unitOfWork = {
      run: (work, options) => this.serialize(() => this.transact(work, options)),
      read: (work) => this.serialize(() => work({ drafts: this.repository(), log: this.log })),
    };
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
      scrubOrderDraft: async (number) => {
        const s = this.drafts.get(number);
        if (s?.kind !== "order") return;
        this.drafts.set(number, {
          ...s, currentText: "deleted", proposedText: "deleted", currentNorm: "deleted", proposedNorm: "deleted", orderPayload: null, revision: s.revision + 1,
        });
      },
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

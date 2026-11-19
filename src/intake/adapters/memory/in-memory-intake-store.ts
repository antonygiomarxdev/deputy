import type { Instant } from "../../../shared/instant";
import type { OwnerLease } from "../../../shared/owner-lease";
import type { ProviderName } from "../../../shared/provider-name";
import type { SendId } from "../../../shared/send-id";
import type { SourceChange } from "../../domain/message";
import type { PendingChange } from "../../ports/pending-changes-reader";
import { LeaseLostError, type IntakeRepos, type IntakeUnitOfWork } from "../../ports/intake-unit-of-work";
import { InMemoryOwnerNumbersRepository } from "./in-memory-owner-numbers-repository";
import { copyState, type State } from "./in-memory-state";
import { inMemoryMessageRepository } from "./in-memory-message-repository";
import { inMemoryChatRepository } from "./in-memory-chat-state-repository";
import { inMemoryRejectionRepository } from "./in-memory-rejection-repository";
import { inMemorySyncRepository } from "./in-memory-sync-state-repository";
import { inMemoryOutgoingRepository } from "./in-memory-outgoing-repository";
import { inMemoryPendingChanges } from "./in-memory-pending-changes-reader";

/** The repositories and the unit of work over one state object; the unit of work restores a copy when `work` throws. */
export class InMemoryIntakeStore {
  /** With a lease, the unit of work refuses to run when it is not ours (the SQLite adapter always checks). */
  constructor(private readonly lease?: OwnerLease) {}

  private state: State = {
    nextSeq: 1,
    messages: new Map(),
    chats: new Map(),
    rejections: [],
    nextRejectionId: 1,
    pruned: 0,
    sync: new Map(),
    outgoingParts: new Map(),
    sends: new Map(),
    sourceChanges: [],
    pending: [],
  };
  readonly owners = new InMemoryOwnerNumbersRepository();
  // the repositories read the state through this accessor: a rollback replaces the state object
  private readonly s = (): State => this.state;

  readonly repos: IntakeRepos = {
    messages: inMemoryMessageRepository(this.s),
    chats: inMemoryChatRepository(this.s),
    rejections: inMemoryRejectionRepository(this.s),
    syncState: inMemorySyncRepository(this.s),
    outgoing: inMemoryOutgoingRepository(this.s),
    owners: this.owners,
    pending: inMemoryPendingChanges(this.s),
  };

  readonly unitOfWork: IntakeUnitOfWork = {
    run: async (work) => {
      // like the SQLite unit of work: no write unless the lease is ours
      if (this.lease !== undefined && !(await this.lease.isOwner())) throw new LeaseLostError("the owner lease is not ours");
      const before = copyState(this.state);
      try {
        return await work(this.repos);
      } catch (e) {
        this.state = before;
        throw e;
      }
    },
  };

  /** Test seam: what SPEC-04's send path would write. */
  addOutgoingPart(provider: ProviderName, providerMessageId: string, sendId: SendId, part: number): void {
    this.state.outgoingParts.set(`${provider}:${providerMessageId}`, { sendId, part });
  }

  /** Test seam: what the command line writes into pending_changes. */
  addPendingChange(key: PendingChange["key"], value: string, command: string, at: Instant): void {
    this.state.pending.push({ id: this.state.pending.length + 1, key, value, command, at, appliedAt: null });
  }

  /** Test seam: the source_changes rows written so far. */
  sourceChanges(): readonly SourceChange[] {
    return this.state.sourceChanges;
  }
}

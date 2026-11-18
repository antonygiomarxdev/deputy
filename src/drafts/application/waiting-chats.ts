import type { Instant } from "../../shared/instant";
import { toIso } from "../domain/time";
import type { WaitingChat, WaitingChats } from "../ports/inbound";
import type { UnitOfWork } from "../ports/outbound";

export class WaitingChatsUseCase implements WaitingChats {
  constructor(private readonly deps: { unitOfWork: UnitOfWork; sessionStartedAt: Instant }) {}

  /** A pure read: no lease check. No draft text is returned. */
  async run(): Promise<WaitingChat[]> {
    const open = await this.deps.unitOfWork.run((tx) => tx.drafts.listOpen(), { requireLease: false });
    return open.map((draft) => {
      const d = draft.snapshot();
      const state = d.state === "sending" || d.state === "recording" ? "waiting" : d.state;
      if (state !== "waiting" && state !== "held" && state !== "failed" && state !== "unknown") {
        throw new Error(`open draft ${d.number} is in state '${state}'`);
      }
      return { number: d.number, kind: d.kind, chat: d.chat, writtenAt: toIso(d.madeAt), state, earlierSession: d.madeAt < this.deps.sessionStartedAt };
    });
  }
}

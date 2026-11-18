import { parseChatId } from "../../shared/chat-id";
import { messageIdKey } from "../../shared/message-id";
import type { LogEntry } from "../domain/log-entry";
import { toIso } from "../domain/time";
import type { LogEntryView, ReadDraftLog } from "../ports/inbound";
import type { UnitOfWork } from "../ports/outbound";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export class ReadDraftLogUseCase implements ReadDraftLog {
  constructor(private readonly deps: { unitOfWork: UnitOfWork }) {}

  async run(input: Parameters<ReadDraftLog["run"]>[0]): ReturnType<ReadDraftLog["run"]> {
    const limit = input.limit ?? DEFAULT_LIMIT;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) return { ok: false, refusal: { code: "bad_limit" } };
    const chat = input.chat === undefined ? undefined : parseChatId(input.chat);
    if (chat === null) return { ok: true, value: { entries: [], nextBefore: null } }; // no chat has that id, so none has entries

    return {
      ok: true,
      value: await this.deps.unitOfWork.read(async (tx) => {
        // one more than asked: it says whether older entries exist, without a second query
        const found = await tx.log.page({
          ...(chat === undefined ? {} : { chat }),
          ...(input.after === undefined ? (input.before === undefined ? {} : { before: input.before }) : { after: input.after }),
          limit: limit + 1,
        });
        const shown = found.slice(0, limit);
        const answered = new Map<number, string | null>();
        for (const e of shown) {
          if (e.draft === null || answered.has(e.draft) || !isReplyDecision(e)) continue;
          const answers = (await tx.drafts.get(e.draft))?.snapshot().answers ?? null;
          answered.set(e.draft, answers === null ? null : messageIdKey(answers));
        }
        const views = shown.map((e): LogEntryView => view(e, answered));
        const older = input.after === undefined && found.length > limit;
        return { entries: views, nextBefore: older ? (shown.at(-1)?.id ?? null) : null };
      }),
    };
  }
}

/** The owner's go or no on a reply: the only entries that name the customer message the draft answered. */
function isReplyDecision(e: LogEntry): boolean {
  return (e.kind === "approved" || e.kind === "rejected") && e.draftKind === "reply";
}

function view(e: LogEntry, answered: ReadonlyMap<number, string | null>): LogEntryView {
  const replyDecision = isReplyDecision(e);
  return {
    id: e.id,
    at: toIso(e.at),
    kind: e.kind,
    draft: e.draft,
    chat: e.chat,
    proposedText: e.proposedText,
    finalText: e.finalText,
    reason: e.reason,
    ownerWords: e.ownerWords,
    scrubbed: e.scrubbed,
    answersMessageId: replyDecision && e.draft !== null ? (answered.get(e.draft) ?? null) : null,
  };
}


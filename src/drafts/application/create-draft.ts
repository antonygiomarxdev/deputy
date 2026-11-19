import { parseChatId, type ChatId } from "../../shared/chat-id";
import type { Clock } from "../../shared/clock";
import type { Instant } from "../../shared/instant";
import type { OwnerLease } from "../../shared/owner-lease";
import { Draft, isInFlight, type DraftKind, type DraftNumber, type DraftSnapshot } from "../domain/draft";
import type { DraftEvent } from "../domain/events";
import { toLogEntries } from "../domain/log-mapper";
import { voidApprovals, withLiveApproval } from "./live-approval";
import { messageView } from "./message-view";
import { refuse, refusalOfError } from "./refusal-of-error";
import type { CreateDraft, CreateDraftResult, Outcome } from "../ports/inbound";
import type { ChatMessage, ChatReader } from "../ports/chat";
import type { OrderPreparer } from "../ports/orders";
import type { Transaction, UnitOfWork } from "../ports/store";

type Input = Parameters<CreateDraft["run"]>[0];
type Deps = { clock: Clock; lease: OwnerLease; unitOfWork: UnitOfWork; chats: ChatReader; orders: OrderPreparer };

/** What the checks before the write establish: the chat, whether it is the dev world, and the message the draft answers. */
interface Gate {
  chat: ChatId;
  dev: boolean;
  latest: ChatMessage;
  answered: ChatMessage | null;
  checkedStoredAt: Instant;
}

/** The open draft of the same chat and kind that a new one replaces. */
interface Previous {
  existing: Draft;
  before: DraftSnapshot;
  replacedState: "waiting" | "held" | "failed";
}

export class CreateDraftUseCase implements CreateDraft {
  constructor(private readonly deps: Deps) {}

  async run(input: Input): Promise<Outcome<CreateDraftResult>> {
    const { clock, unitOfWork, orders } = this.deps;
    const gate = await checkRequest(this.deps, input);
    if (!gate.ok) return gate;
    const content = await contentOf(orders, gate.value.chat, input);
    if (!content.ok) return content;
    const { text, orderPayload } = content.value;
    const g = gate.value;

    try {
      return await unitOfWork.run(async (tx): Promise<Outcome<CreateDraftResult>> => {
        const previous = await openPrevious(tx, g.chat, input.kind);
        if (!previous.ok) return previous;

        const now = clock.now();
        const number = await tx.drafts.nextNumber();
        const proposed = Draft.propose({
          number, kind: input.kind, chat: g.chat, text, now, dev: g.dev, answers: g.answered?.id ?? null,
          basis: { messageId: g.latest.id, sentAt: g.latest.sentAt }, checkedStoredAt: g.checkedStoredAt, orderPayload,
        });
        if (!("draft" in proposed)) return refuse({ code: "empty_text" });

        const events: DraftEvent[] = [];
        let approvalEntryId: number | null = null;
        if (previous.value) {
          const replaced = await replacePrevious(tx, previous.value, number, now);
          if (!replaced.ok) return replaced;
          events.push(...replaced.value.events);
          approvalEntryId = replaced.value.approvalEntryId;
        }
        await tx.drafts.save(proposed.draft);
        events.push(...proposed.events);
        await tx.log.append(toLogEntries(events, { approvalEntryId }));

        const previousDraft = previous.value;
        return {
          ok: true,
          value: {
            number, kind: input.kind, state: "waiting", chat: g.chat, madeAt: now, text,
            answers: g.answered ? messageView(g.answered) : null,
            replaced: previousDraft ? { number: previousDraft.before.number, state: previousDraft.replacedState } : null,
          },
        };
      });
    } catch (e) {
      return refusalOfError(e);
    }
  }
}

/** The checks before any write: the owner, the chat, the text, and the chat's state. */
async function checkRequest(d: Deps, input: Input): Promise<Outcome<Gate>> {
  if (!(await d.lease.isOwner())) return refuse({ code: "not_owner" });
  const chat = parseChatId(input.chat);
  if (chat === null) return refuse({ code: "chat_not_found" });
  if (input.kind === "reply" && input.text.trim() === "") return refuse({ code: "empty_text" });

  const checkedStoredAt = d.clock.now(); // before describe: anything stored after this is "new since the draft"
  const info = await d.chats.describe(chat);
  if (info === null) return refuse({ code: "chat_not_found" });
  if (!info.activeWorldIsDev && !info.hasNonDevMessage) return refuse({ code: "dev_messages_only" });
  if (!info.hasCustomerMessage || info.latest === null) return refuse({ code: "no_customer_message" });

  return {
    ok: true,
    value: {
      chat,
      dev: info.activeWorldIsDev,
      latest: info.latest,
      answered: input.kind === "reply" ? info.latestCustomer : null,
      checkedStoredAt,
    },
  };
}

/** The text of a reply, or the summary and payload of a prepared order. */
async function contentOf(
  orders: OrderPreparer,
  chat: ChatId,
  input: Input,
): Promise<Outcome<{ text: string; orderPayload: string | null }>> {
  if (input.kind === "reply") return { ok: true, value: { text: input.text, orderPayload: null } };
  const prepared = await orders.prepare(chat, input.order);
  if (!prepared.ok) return refuse({ code: "order_rejected", reasons: prepared.reasons });
  return { ok: true, value: { text: prepared.summary, orderPayload: prepared.payload } };
}

/** The open draft of this chat and kind, if any; refuses when it cannot be replaced now. `value` is null when there is none. */
async function openPrevious(tx: Transaction, chat: ChatId, kind: DraftKind): Promise<Outcome<Previous | null>> {
  const open = await tx.drafts.openFor(chat, kind);
  const existing = open === null ? null : await withLiveApproval(tx, open);
  if (existing === null) return { ok: true, value: null };
  const before = existing.snapshot();
  if (isInFlight(before.state)) return refuse({ code: "send_in_progress", number: before.number });
  if (before.state === "unknown") return refuse({ code: "outcome_unknown_open", number: before.number });
  if (before.state !== "waiting" && before.state !== "held" && before.state !== "failed") {
    return refuse({ code: "draft_closed", number: before.number, state: before.state });
  }
  return { ok: true, value: { existing, before, replacedState: before.state } };
}

/** The old draft is saved first: it leaves the one-open-draft index before the new one enters it. */
async function replacePrevious(
  tx: Transaction,
  previous: Previous,
  number: DraftNumber,
  now: Instant,
): Promise<Outcome<{ events: DraftEvent[]; approvalEntryId: number | null }>> {
  const replaced = previous.existing.replaceBy({ number, now });
  if (!replaced.ok) return refuse({ code: "stale_draft", number: previous.before.number });
  await tx.drafts.save(previous.existing);
  const approvalEntryId = await voidApprovals(tx, replaced.events, previous.before.number, now);
  return { ok: true, value: { events: [...replaced.events], approvalEntryId } };
}

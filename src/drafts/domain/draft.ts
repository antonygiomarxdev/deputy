import type { ChatId } from "../../shared/chat-id";
import type { Instant } from "../../shared/instant";
import { messageIdKey, type MessageId } from "../../shared/message-id";
import { normalizeText } from "../../shared/text";
import type { Approval } from "./approval";
import type { DraftEvent } from "./events";

export type DraftKind = "reply" | "order";
export type DraftNumber = number; // integer >= 1, given by DraftRepository.nextNumber
export type DraftState =
  | "waiting"
  | "held"
  | "sending"
  | "recording"
  | "sent"
  | "recorded"
  | "failed"
  | "unknown"
  | "rejected"
  | "replaced";
export const OPEN_STATES: readonly DraftState[] = ["waiting", "held", "failed", "unknown", "sending", "recording"];
export const CLOSED_STATES: readonly DraftState[] = ["sent", "recorded", "rejected", "replaced"];
export type MessageMark = { readonly messageId: MessageId; readonly sentAt: Instant };
export type Mark = { readonly sentAt: Instant; readonly storedAt: Instant };

export interface DraftSnapshot {
  readonly number: DraftNumber;
  readonly kind: DraftKind;
  readonly chat: ChatId;
  readonly state: DraftState;
  readonly proposedText: string; // verbatim, never trimmed or reformatted
  readonly currentText: string; // verbatim
  readonly proposedNorm: string; // normalizeText(proposedText), for the copied-words check
  readonly currentNorm: string;
  readonly textVersion: number; // 1 at creation, +1 on each text change
  readonly shownVersion: number | null;
  readonly revision: number; // 1 at creation; the repository raises it on each save
  readonly madeAt: Instant;
  readonly dev: boolean; // the world the draft was made in
  readonly answers: MessageId | null; // replies only: the customer message answered
  readonly basis: MessageMark; // latest message of the chat when the draft was made
  readonly checkedThrough: Mark; // moves at a hold (SPEC-03)
  readonly pendingChoice: boolean; // SPEC-03
  readonly holdReason: string | null; // reason codes joined by ","
  readonly failReason: string | null;
  readonly orderPayload: string | null;
  readonly orderId: string | null;
  readonly replacedBy: DraftNumber | null;
  readonly closedAt: Instant | null;
  readonly retryAt: Instant | null; // SPEC-03
  readonly attempts: number; // SPEC-03
  readonly approval: Approval | null; // the live approval; never stored in the drafts row
}

type Refused = { readonly ok: false; readonly reason: "closed" | "in_flight" | "unknown_open" | "empty_text" };
export type DraftChange = { readonly ok: true; readonly events: readonly DraftEvent[] } | Refused;

/** The state gate shared by every change: closed, in flight, and (unless allowed) unknown. */
function gate(state: DraftState, unknownAllowed: boolean): Refused | null {
  if (CLOSED_STATES.includes(state)) return { ok: false, reason: "closed" };
  if (state === "sending" || state === "recording") return { ok: false, reason: "in_flight" };
  if (state === "unknown" && !unknownAllowed) return { ok: false, reason: "unknown_open" };
  return null;
}

export class Draft {
  private constructor(private s: DraftSnapshot) {}

  static propose(input: {
    number: DraftNumber;
    kind: DraftKind;
    chat: ChatId;
    text: string;
    now: Instant;
    dev: boolean;
    answers: MessageId | null;
    basis: MessageMark;
    checkedStoredAt: Instant;
    orderPayload: string | null;
  }): { draft: Draft; events: readonly DraftEvent[] } | { ok: false; reason: "empty_text" } {
    if (input.text.trim() === "") return { ok: false, reason: "empty_text" };
    const norm = normalizeText(input.text);
    const draft = new Draft({
      number: input.number,
      kind: input.kind,
      chat: input.chat,
      state: "waiting",
      proposedText: input.text,
      currentText: input.text,
      proposedNorm: norm,
      currentNorm: norm,
      textVersion: 1,
      shownVersion: null,
      revision: 1,
      madeAt: input.now,
      dev: input.dev,
      answers: input.answers,
      basis: input.basis,
      checkedThrough: { sentAt: input.basis.sentAt, storedAt: input.checkedStoredAt },
      pendingChoice: false,
      holdReason: null,
      failReason: null,
      orderPayload: input.orderPayload,
      orderId: null,
      replacedBy: null,
      closedAt: null,
      retryAt: null,
      attempts: 0,
      approval: null,
    });
    const proposed: DraftEvent = {
      ...draft.base(input.now),
      type: "DraftProposed",
      text: input.text,
      answersMessageId: input.answers ? messageIdKey(input.answers) : null,
    };
    return { draft, events: [proposed] };
  }

  static rehydrate(snapshot: DraftSnapshot): Draft {
    return new Draft({ ...snapshot });
  }

  snapshot(): DraftSnapshot {
    return { ...this.s };
  }

  /** waiting, held or failed only. Sets "waiting", raises textVersion, clears shownVersion, voids a live approval. */
  changeText(input: { text: string; orderPayload: string | null; ownerWords: string; now: Instant }): DraftChange {
    const refused = gate(this.s.state, false);
    if (refused) return refused;
    if (input.text.trim() === "") return { ok: false, reason: "empty_text" };
    const events: DraftEvent[] = [
      { ...this.base(input.now), type: "TextChanged", proposedText: this.s.proposedText, newText: input.text, ownerWords: input.ownerWords },
    ];
    this.voidApproval(events, "changed", input.now);
    this.s = {
      ...this.s,
      state: "waiting",
      currentText: input.text,
      currentNorm: normalizeText(input.text),
      orderPayload: input.orderPayload,
      textVersion: this.s.textVersion + 1,
      shownVersion: null,
      approval: null,
    };
    return { ok: true, events };
  }

  /** waiting, held, failed or unknown. Sets "rejected", closes it, voids a live approval. */
  reject(input: { ownerWords: string; now: Instant }): DraftChange {
    const refused = gate(this.s.state, true);
    if (refused) return refused;
    const events: DraftEvent[] = [{ ...this.base(input.now), type: "DraftRejected", ownerWords: input.ownerWords }];
    this.voidApproval(events, "rejected", input.now);
    this.s = { ...this.s, state: "rejected", closedAt: input.now, approval: null };
    return { ok: true, events };
  }

  /** waiting, held or failed. Sets "replaced", closes it, voids a live approval. */
  replaceBy(input: { number: DraftNumber; now: Instant }): DraftChange {
    const refused = gate(this.s.state, false);
    if (refused) return refused;
    const events: DraftEvent[] = [{ ...this.base(input.now), type: "DraftReplaced", replacedBy: input.number }];
    this.voidApproval(events, "replaced", input.now);
    this.s = { ...this.s, state: "replaced", replacedBy: input.number, closedAt: input.now, approval: null };
    return { ok: true, events };
  }

  /** Sets shownVersion to textVersion. Returns false when it was already so. */
  markShown(): boolean {
    if (this.s.shownVersion === this.s.textVersion) return false;
    this.s = { ...this.s, shownVersion: this.s.textVersion };
    return true;
  }

  private base(at: Instant) {
    return { draft: this.s.number, draftKind: this.s.kind, chat: this.s.chat, at };
  }

  private voidApproval(events: DraftEvent[], reason: "changed" | "replaced" | "rejected", at: Instant): void {
    const a = this.s.approval;
    if (a && a.voidedAt === null) events.push({ ...this.base(at), type: "ApprovalVoided", reason, approvalId: a.id });
  }
}

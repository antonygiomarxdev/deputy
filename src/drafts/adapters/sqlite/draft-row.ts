import { flag, num, numOrNull, str, strOrNull } from "../../../adapters/sqlite/row";
import type { ChatId } from "../../../shared/chat-id";
import { messageIdKey, type MessageId } from "../../../shared/message-id";
import type { ProviderName } from "../../../shared/provider-name";
import type { SqlRow, SqlValue } from "../../../shared/sql-database";
import { CLOSED_STATES, OPEN_STATES, type DraftKind, type DraftSnapshot, type DraftState } from "../../domain/draft";
import { fromIso, toIso } from "../../domain/time";

export const COLUMNS = [
  "number", "kind", "chat", "state", "proposed_text", "current_text", "proposed_norm", "current_norm",
  "text_version", "shown_version", "revision", "made_at", "answers_message_id", "dev", "basis_message_id",
  "basis_sent_at", "checked_sent_at", "checked_stored_at", "pending_choice", "hold_reason", "fail_reason",
  "order_payload", "order_id", "replaced_by", "closed_at", "retry_at", "attempts",
] as const;

const isProviderName = (v: string): v is ProviderName => v === "kapso" || v === "dev";
const isKind = (v: string): v is DraftKind => v === "reply" || v === "order";
const isState = (v: string): v is DraftState => [...OPEN_STATES, ...CLOSED_STATES].includes(v as DraftState);

const isoOrNull = (at: number | null): string | null => (at === null ? null : toIso(at));
const timeOrNull = (r: SqlRow, c: string): number | null => {
  const v = strOrNull(r, c);
  return v === null ? null : fromIso(v);
};

function parseMessageKey(key: string): MessageId {
  const cut = key.indexOf(":");
  const provider = key.slice(0, cut);
  if (cut < 0 || !isProviderName(provider)) throw new Error(`stored message id '${key}' has no known provider`);
  return { provider, providerMessageId: key.slice(cut + 1) };
}

/** Values in `COLUMNS` order. The approval is never stored in the drafts row. */
export function toValues(s: DraftSnapshot): SqlValue[] {
  return [
    s.number, s.kind, s.chat, s.state, s.proposedText, s.currentText, s.proposedNorm, s.currentNorm,
    s.textVersion, s.shownVersion, s.revision, toIso(s.madeAt), s.answers ? messageIdKey(s.answers) : null,
    s.dev ? 1 : 0, messageIdKey(s.basis.messageId), toIso(s.basis.sentAt), toIso(s.checkedThrough.sentAt),
    toIso(s.checkedThrough.storedAt), s.pendingChoice ? 1 : 0, s.holdReason, s.failReason, s.orderPayload,
    s.orderId, s.replacedBy, isoOrNull(s.closedAt), isoOrNull(s.retryAt), s.attempts,
  ];
}

export function fromRow(r: SqlRow): DraftSnapshot {
  const kind = str(r, "kind");
  const state = str(r, "state");
  if (!isKind(kind)) throw new Error(`stored draft kind '${kind}'`);
  if (!isState(state)) throw new Error(`stored draft state '${state}'`);
  const answers = strOrNull(r, "answers_message_id");
  return {
    number: num(r, "number"),
    kind,
    // the row mapper is the one place a ChatId is cast: the value was a ChatId when it was written
    chat: str(r, "chat") as ChatId,
    state,
    proposedText: str(r, "proposed_text"),
    currentText: str(r, "current_text"),
    proposedNorm: str(r, "proposed_norm"),
    currentNorm: str(r, "current_norm"),
    textVersion: num(r, "text_version"),
    shownVersion: numOrNull(r, "shown_version"),
    revision: num(r, "revision"),
    madeAt: fromIso(str(r, "made_at")),
    dev: flag(r, "dev"),
    answers: answers === null ? null : parseMessageKey(answers),
    basis: { messageId: parseMessageKey(str(r, "basis_message_id")), sentAt: fromIso(str(r, "basis_sent_at")) },
    checkedThrough: { sentAt: fromIso(str(r, "checked_sent_at")), storedAt: fromIso(str(r, "checked_stored_at")) },
    pendingChoice: flag(r, "pending_choice"),
    holdReason: strOrNull(r, "hold_reason"),
    failReason: strOrNull(r, "fail_reason"),
    orderPayload: strOrNull(r, "order_payload"),
    orderId: strOrNull(r, "order_id"),
    replacedBy: numOrNull(r, "replaced_by"),
    closedAt: timeOrNull(r, "closed_at"),
    retryAt: timeOrNull(r, "retry_at"),
    attempts: num(r, "attempts"),
    approval: null,
  };
}

import { flag, num, numOrNull, str, strOrNull } from "../../../adapters/sqlite/row";
import type { ChatId } from "../../../shared/chat-id";
import type { SqlRow } from "../../../shared/sql-database";
import type { DraftKind } from "../../domain/draft";
import type { LogEntry, LogKind } from "../../domain/log-entry";
import { fromIso } from "../../domain/time";

const KINDS: readonly string[] = [
  "proposed", "replaced", "text_changed", "approved", "approval_voided", "rejected", "held", "owner_choice",
  "sending", "sent", "failed", "unknown", "recorded", "order_command", "order_deleted",
];
const isLogKind = (v: string): v is LogKind => KINDS.includes(v);
const isDraftKind = (v: string): v is DraftKind => v === "reply" || v === "order";

/** One drafts_log row to an entry. The one place a stored log row is read; an unknown kind is a stored-data error. */
export function fromRow(r: SqlRow): LogEntry {
  const kind = str(r, "kind");
  const draftKind = strOrNull(r, "draft_kind");
  if (!isLogKind(kind)) throw new Error(`stored log kind '${kind}'`);
  if (draftKind !== null && !isDraftKind(draftKind)) throw new Error(`stored draft kind '${draftKind}'`);
  return {
    id: num(r, "id"),
    at: fromIso(str(r, "at")),
    kind,
    draft: numOrNull(r, "draft_number"),
    draftKind,
    // the row mapper is the one place a ChatId is cast: the value was a ChatId when it was written
    chat: str(r, "chat") as ChatId,
    proposedText: strOrNull(r, "proposed_text"),
    finalText: strOrNull(r, "final_text"),
    reason: strOrNull(r, "reason"),
    ownerWords: strOrNull(r, "owner_words"),
    approvalEntryId: numOrNull(r, "approval_entry_id"),
    sendId: strOrNull(r, "send_id"),
    orderRef: strOrNull(r, "order_ref"),
    scrubbed: flag(r, "scrubbed"),
  };
}

import { num, numOrNull, str, strOrNull } from "../../../adapters/sqlite/row";
import { parseChatId, type ChatId } from "../../../shared/chat-id";
import type { Instant } from "../../../shared/instant";
import type { MessageId } from "../../../shared/message-id";
import type { ProviderName } from "../../../shared/provider-name";
import { parseSendId, type SendId } from "../../../shared/send-id";
import type { SqlExecutor, SqlRow } from "../../../shared/sql-database";
import {
  OutgoingSend,
  type OutgoingPart,
  type SendFailure,
  type SendState,
} from "../../domain/outgoing-send";
import type { OutgoingRepository } from "../../ports/outgoing-repository";

function stateOf(r: SqlRow): SendState {
  const s = str(r, "state");
  if (s !== "pending" && s !== "sent" && s !== "failed" && s !== "unknown") throw new Error(`send state '${s}'`);
  return s;
}

function failureOf(r: SqlRow): SendFailure | null {
  const f = strOrNull(r, "failure_reason");
  if (f === null) return null;
  if (f !== "credentials" && f !== "unreachable" && f !== "quota" && f !== "rejected" && f !== "rate_limited") {
    throw new Error(`failure reason '${f}'`);
  }
  return f;
}

function providerOf(p: string): ProviderName {
  if (p !== "kapso" && p !== "dev") throw new Error(`provider '${p}'`);
  return p;
}

export class SqliteOutgoingRepository implements OutgoingRepository {
  constructor(private readonly ex: SqlExecutor) {}

  async find(sendId: SendId): Promise<OutgoingSend | null> {
    const [r] = await this.ex.query("SELECT * FROM outgoing WHERE send_id = ?", [sendId]);
    if (r === undefined) return null;
    const chat = parseChatId(str(r, "chat_id"));
    if (chat === null) throw new Error("stored chat id is empty");
    const parts: OutgoingPart[] = (await this.ex.query("SELECT * FROM outgoing_parts WHERE send_id = ? ORDER BY part", [sendId])).map((p) => ({
      index: num(p, "part"),
      text: str(p, "text"),
      providerMessageId: strOrNull(p, "provider_message_id"),
      state: stateOf(p),
    }));
    return OutgoingSend.rehydrate({
      sendId,
      chat,
      text: str(r, "text"),
      state: stateOf(r),
      failureReason: failureOf(r),
      createdAt: num(r, "created_at"),
      finishedAt: numOrNull(r, "finished_at"),
      parts,
    });
  }

  async insert(s: OutgoingSend): Promise<void> {
    const p = s.props;
    await this.ex.run(
      "INSERT INTO outgoing (send_id, chat_id, text, parts_total, state, failure_reason, created_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [p.sendId, p.chat, p.text, p.parts.length, p.state, p.failureReason, p.createdAt, p.finishedAt],
    );
    for (const part of p.parts) {
      await this.ex.run(
        "INSERT INTO outgoing_parts (send_id, part, text, provider, provider_message_id, state) VALUES (?, ?, ?, NULL, ?, ?)",
        [p.sendId, part.index, part.text, part.providerMessageId, part.state],
      );
    }
  }

  async savePart(s: OutgoingSend, part: number, provider: ProviderName): Promise<void> {
    const found = s.props.parts.find((x) => x.index === part);
    if (found === undefined) throw new RangeError(`the send has no part ${part}`);
    await this.ex.run(
      "UPDATE outgoing_parts SET provider = ?, provider_message_id = ?, state = ? WHERE send_id = ? AND part = ?",
      [found.providerMessageId === null ? null : provider, found.providerMessageId, found.state, s.props.sendId, part],
    );
  }

  async saveSend(s: OutgoingSend): Promise<void> {
    const p = s.props;
    await this.ex.run("UPDATE outgoing SET state = ?, failure_reason = ?, finished_at = ? WHERE send_id = ?", [
      p.state,
      p.failureReason,
      p.finishedAt,
      p.sendId,
    ]);
  }

  async findByProviderId(
    provider: ProviderName,
    providerMessageId: string,
  ): Promise<{ sendId: SendId; part: number } | null> {
    const [r] = await this.ex.query(
      "SELECT send_id, part FROM outgoing_parts WHERE provider = ? AND provider_message_id = ?",
      [provider, providerMessageId],
    );
    if (r === undefined) return null;
    const sendId = parseSendId(str(r, "send_id"));
    if (sendId === null) throw new Error("stored send id is invalid");
    return { sendId, part: num(r, "part") };
  }

  async markPendingAsUnknown(): Promise<number> {
    await this.ex.run("UPDATE outgoing_parts SET state = 'unknown' WHERE state = 'pending' AND send_id IN (SELECT send_id FROM outgoing WHERE state = 'pending')");
    return (await this.ex.run("UPDATE outgoing SET state = 'unknown' WHERE state = 'pending'")).changes;
  }

  async candidatesForPart(chat: ChatId, text: string, since: Instant): Promise<MessageId[]> {
    const rows = await this.ex.query(
      `SELECT m.provider, m.provider_message_id FROM messages m
       WHERE m.chat_id = ? AND m.source = 'owner_app' AND m.text = ? AND m.sent_at >= ?
         AND NOT EXISTS (SELECT 1 FROM outgoing_parts o WHERE o.provider = m.provider AND o.provider_message_id = m.provider_message_id)
       ORDER BY m.sent_at, m.seq`,
      [chat, text, since],
    );
    return rows.map((r) => ({ provider: providerOf(str(r, "provider")), providerMessageId: str(r, "provider_message_id") }));
  }
}

import type { ChatId } from "../../shared/chat-id";
import type { Clock } from "../../shared/clock";
import type { Instant } from "../../shared/instant";
import type { ProviderName } from "../../shared/provider-name";
import type { SendId } from "../../shared/send-id";
import { Message } from "../domain/message";
import type { OwnerNumbers } from "../domain/owner-numbers";
import { cutProfileName } from "../domain/profile-name";
import type { IntakeRepos } from "../ports/intake-unit-of-work";
import type { ProviderEvent, ProviderMessage } from "../ports/provider";
import { newTally, type StoreTally } from "./store-tally";

export interface StoreInput {
  provider: ProviderName;
  events: readonly ProviderEvent[];
}

export interface StoredSummary {
  chat: ChatId;
  source: "customer" | "owner_app";
  count: number;
}

export interface StoreOutcome {
  stored: number;
  duplicates: number;
  ignored: number;
  edits: number;
  rejected: number;
  summaries: readonly StoredSummary[];
  unlinkedOwnerReplies: number;
}

/** What one run reads once before its loop, and the tally it fills. */
interface Run {
  r: IntakeRepos;
  provider: ProviderName;
  owners: OwnerNumbers;
  connectedAt: Instant | null;
  now: Instant;
  tally: StoreTally;
}

/** The id as the provider sent it for the chat's other party: where a send to this chat goes (ADR-012). */
function counterpartId(p: ProviderMessage): string | null {
  return p.counterpart ?? (p.direction === "inbound" ? p.from : null);
}

export class StoreMessages {
  constructor(private readonly d: { clock: Clock }) {}

  /** Runs inside the caller's transaction (`r`). Never calls the provider. */
  async store(r: IntakeRepos, i: StoreInput): Promise<StoreOutcome> {
    const now = this.d.clock.now();
    const x: Run = {
      r,
      provider: i.provider,
      owners: await r.owners.load(),
      connectedAt: await r.syncState.connectedAt(i.provider),
      now,
      tally: newTally(),
    };
    for (const event of i.events) {
      if (event.kind === "ignored") x.tally.ignored++;
      else if (event.kind === "edit") await applyEdit(x, event);
      else if (event.kind === "delete") await applyDelete(x, event);
      else await storeNew(x, event.message);
    }

    const dev = i.provider === "dev";
    for (const [chat, seen] of x.tally.touched) await r.chats.recompute(chat, dev, now, seen);
    for (const [chat, n] of x.tally.names) await r.chats.setProfileName(chat, dev, n.name, n.at);

    const t = x.tally;
    return {
      stored: t.stored,
      duplicates: t.duplicates,
      ignored: t.ignored,
      edits: t.edits,
      rejected: t.rejected,
      summaries: [...t.counts.values()],
      unlinkedOwnerReplies: t.unlinkedOwnerReplies,
    };
  }
}

async function applyEdit(x: Run, event: Extract<ProviderEvent, { kind: "edit" }>): Promise<void> {
  const found = await x.r.messages.find({ provider: x.provider, providerMessageId: event.providerMessageId });
  if (found === null) {
    x.tally.ignored++;
    return;
  }
  await x.r.messages.saveEdit(found.props.id, found.applyEdit(event.text, x.now), event.text);
  x.tally.edits++;
}

async function applyDelete(x: Run, event: Extract<ProviderEvent, { kind: "delete" }>): Promise<void> {
  const id = { provider: x.provider, providerMessageId: event.providerMessageId };
  if ((await x.r.messages.find(id)) === null) x.tally.ignored++;
  else await x.r.messages.markDeleted(id);
}

async function storeNew(x: Run, p: ProviderMessage): Promise<void> {
  const { r, tally: t, now } = x;
  const sendId: SendId | null = p.providerMessageId === null ? null : ((await r.outgoing.findByProviderId(x.provider, p.providerMessageId))?.sendId ?? null);
  const message = Message.receive(p, { provider: x.provider, owners: x.owners, matchesSend: sendId !== null, connectedAt: x.connectedAt, now });
  if (!(message instanceof Message)) {
    await r.rejections.add(now, "no_identifier", true);
    t.rejected++;
    return;
  }
  if ((await r.messages.insertIfNew(message)) === "duplicate") {
    await storeDuplicate(x, message, p, sendId);
    return;
  }
  t.stored++;
  const props = message.props;
  const seen = t.touched.get(props.chat);
  t.touched.set(props.chat, {
    providerId: seen?.providerId ?? counterpartId(p),
    conversationRef: p.conversationRef ?? seen?.conversationRef ?? null,
  });
  if (props.history || props.source === "sent_through_deputy") return;
  const key = `${props.chat}|${props.source}`;
  const item = t.counts.get(key);
  t.counts.set(key, { chat: props.chat, source: props.source, count: (item?.count ?? 0) + 1 });
  if (props.mark === "not_attributable") t.unlinkedOwnerReplies++;
  if (props.source === "customer" && p.profileName !== null && p.profileName !== "") {
    // a newest-first page must not leave its oldest name: keep the name of the latest sent message
    if (p.sentAt > (t.names.get(props.chat)?.at ?? -1)) t.names.set(props.chat, { name: cutProfileName(p.profileName), at: p.sentAt });
  }
}

/** A message the store already has: a report that arrived before its send was recorded, or a repeat or an edit. */
async function storeDuplicate(x: Run, message: Message, p: ProviderMessage, sendId: SendId | null): Promise<void> {
  const { r, tally: t, now } = x;
  const known = await r.messages.find(message.props.id);
  // a report that arrived before the send was recorded: it was stored as owner_app, and now it is known to be ours
  if (known !== null && sendId !== null && known.props.source === "owner_app") {
    const changed = known.reclassifyAsDeputySend(sendId, now);
    if (changed.ok) {
      await r.messages.reclassify(known.props.id, changed.change);
      t.touched.set(known.props.chat, t.touched.get(known.props.chat) ?? { providerId: null, conversationRef: null });
    }
    t.duplicates++;
    return;
  }
  if (known !== null && p.edited && p.text !== null && p.text !== known.props.text) {
    await r.messages.saveEdit(known.props.id, known.applyEdit(p.text, now), p.text);
    t.edits++;
  } else {
    t.duplicates++;
  }
}

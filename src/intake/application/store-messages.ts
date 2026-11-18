import type { ChatId } from "../../shared/chat-id";
import type { Clock } from "../../shared/clock";
import type { ProviderName } from "../../shared/provider-name";
import { Message } from "../domain/message";
import { cutProfileName } from "../domain/profile-name";
import type { ChatSeen } from "../ports/chat-state-repository";
import type { IntakeRepos } from "../ports/intake-unit-of-work";
import type { ProviderEvent, ProviderMessage } from "../ports/provider";

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

/** The id as the provider sent it for the chat's other party: where a send to this chat goes (ADR-012). */
function counterpartId(p: ProviderMessage): string | null {
  return p.counterpart ?? (p.direction === "inbound" ? p.from : null);
}

export class StoreMessages {
  constructor(private readonly d: { clock: Clock }) {}

  /** Runs inside the caller's transaction (`r`). Never calls the provider. */
  async store(r: IntakeRepos, i: StoreInput): Promise<StoreOutcome> {
    const now = this.d.clock.now();
    const owners = await r.owners.load();
    const connectedAt = await r.syncState.connectedAt(i.provider);
    const dev = i.provider === "dev";

    let stored = 0;
    let duplicates = 0;
    let ignored = 0;
    let edits = 0;
    let rejected = 0;
    let unlinkedOwnerReplies = 0;
    const counts = new Map<string, StoredSummary>();
    const touched = new Map<ChatId, ChatSeen>();
    const names = new Map<ChatId, { name: string; at: number }>();

    for (const event of i.events) {
      if (event.kind === "ignored") {
        ignored++;
      } else if (event.kind === "edit") {
        const found = await r.messages.find({ provider: i.provider, providerMessageId: event.providerMessageId });
        if (found === null) {
          ignored++;
          continue;
        }
        await r.messages.saveEdit(found.props.id, found.applyEdit(event.text, now), event.text);
        edits++;
      } else if (event.kind === "delete") {
        const id = { provider: i.provider, providerMessageId: event.providerMessageId };
        if ((await r.messages.find(id)) === null) ignored++;
        else await r.messages.markDeleted(id);
      } else {
        const p = event.message;
        const send = p.providerMessageId === null ? null : await r.outgoing.findByProviderId(i.provider, p.providerMessageId);
        const matchesSend = send !== null;
        const message = Message.receive(p, { provider: i.provider, owners, matchesSend, connectedAt, now });
        if (!(message instanceof Message)) {
          await r.rejections.add(now, "no_identifier", true);
          rejected++;
          continue;
        }
        if ((await r.messages.insertIfNew(message)) === "duplicate") {
          const known = await r.messages.find(message.props.id);
          // a report that arrived before the send was recorded: it was stored as owner_app, and now it is known to be ours
          if (known !== null && send !== null && known.props.source === "owner_app") {
            const changed = known.reclassifyAsDeputySend(send.sendId, now);
            if (changed.ok) {
              await r.messages.reclassify(known.props.id, changed.change);
              touched.set(known.props.chat, touched.get(known.props.chat) ?? { providerId: null, conversationRef: null });
            }
            duplicates++;
            continue;
          }
          if (known !== null && p.edited && p.text !== null && p.text !== known.props.text) {
            await r.messages.saveEdit(known.props.id, known.applyEdit(p.text, now), p.text);
            edits++;
          } else {
            duplicates++;
          }
          continue;
        }
        stored++;
        const props = message.props;
        const seen = touched.get(props.chat);
        touched.set(props.chat, {
          providerId: seen?.providerId ?? counterpartId(p),
          conversationRef: p.conversationRef ?? seen?.conversationRef ?? null,
        });
        if (props.history || props.source === "sent_through_deputy") continue;
        const key = `${props.chat}|${props.source}`;
        const item = counts.get(key);
        counts.set(key, { chat: props.chat, source: props.source, count: (item?.count ?? 0) + 1 });
        if (props.mark === "not_attributable") unlinkedOwnerReplies++;
        if (props.source === "customer" && p.profileName !== null && p.profileName !== "") {
          // a newest-first page must not leave its oldest name: keep the name of the latest sent message
          if (p.sentAt > (names.get(props.chat)?.at ?? -1)) names.set(props.chat, { name: cutProfileName(p.profileName), at: p.sentAt });
        }
      }
    }

    for (const [chat, seen] of touched) await r.chats.recompute(chat, dev, now, seen);
    for (const [chat, n] of names) await r.chats.setProfileName(chat, dev, n.name, n.at);

    return { stored, duplicates, ignored, edits, rejected, summaries: [...counts.values()], unlinkedOwnerReplies };
  }
}

import type { ChatId } from "../../shared/chat-id";
import type { Instant } from "../../shared/instant";
import type { MessageId } from "../../shared/message-id";
import { PhoneNumber } from "../../shared/phone-number";
import type { ProviderName } from "../../shared/provider-name";
import type { Source } from "../../shared/source";
import { normalizeText } from "../../shared/text";
import type { IncomingMessage } from "./incoming-message";
import { chatOf, markOf } from "./chat-of";
import { isHistory } from "./history";
import type { OwnerNumbers } from "./owner-numbers";
import { classifySource } from "./source-classifier";

export type Mark = "normal" | "group_chat" | "sender_unknown" | "not_attributable";

export interface MessageVersion {
  readonly version: number;
  readonly text: string | null;
  readonly replacedAt: Instant;
}

export interface MessageProps {
  id: MessageId;
  chat: ChatId;
  conversationRef: string | null;
  sender: PhoneNumber | null;
  providerSender: string | null; // as the provider sent it (ADR-012)
  type: string;
  readable: boolean;
  text: string | null;
  transcript: string | null;
  sentAt: Instant;
  storedAt: Instant;
  origin: string | null;
  source: Source;
  mark: Mark;
  history: boolean;
  dev: boolean;
  edited: boolean;
  deletedBySender: boolean;
}

export interface ReceiveContext {
  provider: ProviderName;
  owners: OwnerNumbers; // snapshot read in the same transaction
  matchesSend: boolean; // an outgoing_parts row has this provider id
  connectedAt: Instant | null; // provider clock at the first catch-up; null before it
  now: Instant;
}

export class Message {
  private constructor(
    private p: MessageProps,
    private history: readonly MessageVersion[],
  ) {}

  static receive(p: IncomingMessage, ctx: ReceiveContext): Message | { rejected: "no_identifier" } {
    if (p.providerMessageId === null || p.providerMessageId === "") return { rejected: "no_identifier" };
    const sender = p.from === null ? null : PhoneNumber.fromInternational(p.from);
    const chat = chatOf(p);
    const source = classifySource({
      matchesSend: ctx.matchesSend,
      sender,
      owners: ctx.owners,
      provider: ctx.provider,
      devOwnerMark: p.devOwnerMark,
    });
    const type = p.type === "" ? "unknown" : p.type;
    return new Message(
      {
        id: { provider: ctx.provider, providerMessageId: p.providerMessageId },
        chat,
        conversationRef: p.conversationRef,
        sender,
        providerSender: p.from,
        type,
        readable: type === "text" && p.text !== null && p.text !== "",
        text: p.text,
        transcript: p.transcript,
        sentAt: p.sentAt,
        storedAt: ctx.now,
        origin: p.origin,
        source,
        mark: markOf(p, sender, chat, ctx.matchesSend),
        history: isHistory({
          provider: ctx.provider,
          connectedAt: ctx.connectedAt,
          sentAt: p.sentAt,
          origin: p.origin,
          source,
        }),
        dev: ctx.provider === "dev",
        edited: p.edited,
        deletedBySender: false,
      },
      [],
    );
  }

  static rehydrate(props: MessageProps, versions: readonly MessageVersion[]): Message {
    return new Message({ ...props }, [...versions]);
  }

  get props(): Readonly<MessageProps> {
    return this.p;
  }

  get versions(): readonly MessageVersion[] {
    return this.history;
  }

  get textNorm(): string | null {
    return this.p.readable && this.p.text !== null ? normalizeText(this.p.text) : null;
  }

  /** Returns the version that was replaced. */
  applyEdit(text: string, at: Instant): MessageVersion {
    const replaced: MessageVersion = { version: this.history.length + 1, text: this.p.text, replacedAt: at };
    this.history = [...this.history, replaced];
    this.p = { ...this.p, text, edited: true };
    return replaced;
  }

  markDeletedBySender(): void {
    this.p = { ...this.p, deletedBySender: true };
  }

  readerText(): string {
    if (this.p.readable) return this.p.text ?? "";
    const label = this.p.type === "audio" ? "voice note" : this.p.type;
    if (this.p.transcript !== null && this.p.transcript !== "") return `${label}, transcript: ${this.p.transcript}`;
    return `[${label}, not readable]`;
  }
}

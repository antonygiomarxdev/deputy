import type { ChatId } from "../../shared/chat-id";
import type { Instant } from "../../shared/instant";
import type { SendId } from "../../shared/send-id";
import { splitText } from "./split-text";

export type SendState = "pending" | "sent" | "failed" | "unknown";
export type SendFailure = "credentials" | "unreachable" | "quota" | "rejected" | "rate_limited";

/** `index` counts from 1. */
export interface OutgoingPart {
  readonly index: number;
  readonly text: string;
  readonly providerMessageId: string | null;
  readonly state: SendState;
}

export interface OutgoingSendProps {
  sendId: SendId;
  chat: ChatId;
  text: string;
  state: SendState;
  failureReason: SendFailure | null;
  createdAt: Instant;
  finishedAt: Instant | null;
  /** Set when the provider's rate limit refused the send: when it may be tried again. */
  retryAt: Instant | null;
  parts: readonly OutgoingPart[];
}

/** The state machine of one send: pending, then sent, failed or unknown; it never goes back to pending. */
export class OutgoingSend {
  private constructor(private p: OutgoingSendProps) {}

  static create(i: { sendId: SendId; chat: ChatId; text: string; createdAt: Instant }): OutgoingSend {
    return new OutgoingSend({
      sendId: i.sendId,
      chat: i.chat,
      text: i.text,
      state: "pending",
      failureReason: null,
      createdAt: i.createdAt,
      finishedAt: null,
      retryAt: null,
      parts: splitText(i.text).map((text, n) => ({ index: n + 1, text, providerMessageId: null, state: "pending" })),
    });
  }

  static rehydrate(p: OutgoingSendProps): OutgoingSend {
    return new OutgoingSend({ ...p, parts: [...p.parts] });
  }

  get props(): OutgoingSendProps {
    return this.p;
  }

  /** The part becomes sent and holds its id: a sent part without an id cannot exist. */
  partSent(index: number, providerMessageId: string): void {
    if (providerMessageId === "") throw new RangeError("a sent part needs a provider message id");
    this.setPart(index, { providerMessageId, state: "sent" });
  }

  /** Every part failed; the send failed. */
  failNothingAccepted(reason: SendFailure, at: Instant, retryAt: Instant | null = null): void {
    this.p = {
      ...this.p,
      state: "failed",
      failureReason: reason,
      finishedAt: at,
      retryAt,
      parts: this.p.parts.map((x) => ({ ...x, state: "failed" })),
    };
  }

  /** The send is unknown. That part is unknown when it may have been accepted, else failed; later parts failed. */
  interrupt(i: { index: number; mayHaveBeenAccepted: boolean; at: Instant }): void {
    this.p = {
      ...this.p,
      state: "unknown",
      finishedAt: i.at,
      parts: this.p.parts.map((x) =>
        x.index < i.index ? x : { ...x, state: x.index === i.index && i.mayHaveBeenAccepted ? "unknown" : "failed" },
      ),
    };
  }

  /** An unknown part of an unknown send becomes sent; when every part is sent, so does the send. Otherwise nothing changes. */
  linkPart(index: number, providerMessageId: string, at: Instant): void {
    if (this.p.state !== "unknown" || providerMessageId === "") return;
    const part = this.p.parts.find((x) => x.index === index);
    if (part?.state !== "unknown") return;
    this.setPart(index, { providerMessageId, state: "sent" });
    if (this.p.parts.every((x) => x.state === "sent")) this.p = { ...this.p, state: "sent", finishedAt: at };
  }

  markAllSentIfComplete(at: Instant): void {
    if (this.p.state === "pending" && this.p.parts.every((x) => x.state === "sent")) {
      this.p = { ...this.p, state: "sent", finishedAt: at };
    }
  }

  /** What was in flight when the process stopped: the send and its pending parts become unknown. */
  markPendingUnknown(): void {
    if (this.p.state !== "pending") return;
    this.p = { ...this.p, state: "unknown", parts: this.p.parts.map((x) => (x.state === "pending" ? { ...x, state: "unknown" } : x)) };
  }

  private setPart(index: number, change: Pick<OutgoingPart, "providerMessageId" | "state">): void {
    if (!this.p.parts.some((x) => x.index === index)) throw new RangeError(`the send has no part ${index}`);
    this.p = { ...this.p, parts: this.p.parts.map((x) => (x.index === index ? { ...x, ...change } : x)) };
  }
}

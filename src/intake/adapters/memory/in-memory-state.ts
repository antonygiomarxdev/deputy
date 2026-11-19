import type { Instant } from "../../../shared/instant";
import type { ProviderName } from "../../../shared/provider-name";
import type { SendId } from "../../../shared/send-id";
import type { ChatState } from "../../domain/chat-state";
import { Message, type SourceChange } from "../../domain/message";
import type { OutgoingSendProps } from "../../domain/outgoing-send";
import type { RejectionNote } from "../../domain/rejection-note";
import type { SyncStateProps } from "../../domain/sync-state";
import type { PendingChange } from "../../ports/pending-changes-reader";

export interface Stored {
  seq: number;
  message: Message;
}
export interface Rejection extends RejectionNote {
  id: number;
}
export interface State {
  nextSeq: number;
  messages: Map<string, Stored>;
  chats: Map<string, ChatState>;
  rejections: Rejection[];
  nextRejectionId: number;
  pruned: number;
  sync: Map<ProviderName, SyncStateProps>;
  outgoingParts: Map<string, { sendId: SendId; part: number }>;
  sends: Map<string, OutgoingSendProps>;
  sourceChanges: SourceChange[];
  pending: (PendingChange & { appliedAt: Instant | null })[];
}

export const copyMessage = (m: Message): Message => Message.rehydrate(m.props, m.versions);

export function copyState(s: State): State {
  return {
    nextSeq: s.nextSeq,
    messages: new Map([...s.messages].map(([k, v]) => [k, { seq: v.seq, message: copyMessage(v.message) }])),
    chats: new Map(s.chats),
    rejections: s.rejections.map((r) => ({ ...r })),
    nextRejectionId: s.nextRejectionId,
    pruned: s.pruned,
    sync: new Map([...s.sync].map(([k, v]) => [k, { ...v }])),
    outgoingParts: new Map(s.outgoingParts),
    sends: new Map(s.sends),
    sourceChanges: [...s.sourceChanges],
    pending: s.pending.map((p) => ({ ...p })),
  };
}

export const bySent = (a: Stored, b: Stored): number => a.message.props.sentAt - b.message.props.sentAt || a.seq - b.seq;

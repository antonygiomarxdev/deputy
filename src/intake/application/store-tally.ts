import type { ChatId } from "../../shared/chat-id";
import type { ChatSeen } from "../ports/chat-state-repository";

/** What one store run counts, and what it collects for the chats it touched. */
export interface StoreTally {
  stored: number;
  duplicates: number;
  ignored: number;
  edits: number;
  rejected: number;
  unlinkedOwnerReplies: number;
  counts: Map<string, { chat: ChatId; source: "customer" | "owner_app"; count: number }>;
  touched: Map<ChatId, ChatSeen>;
  names: Map<ChatId, { name: string; at: number }>;
}

export function newTally(): StoreTally {
  return { stored: 0, duplicates: 0, ignored: 0, edits: 0, rejected: 0, unlinkedOwnerReplies: 0, counts: new Map(), touched: new Map(), names: new Map() };
}

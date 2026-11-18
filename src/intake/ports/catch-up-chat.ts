import type { ChatId } from "../../shared/chat-id";
import type { ChatStateView } from "./views";

/**
 * The pre-send read: one conversation and one outbound page, no mark moved, no sync state written.
 * On `failed` with reason `timeout` the read may still be running: it is not undone and may store messages after the answer,
 * so `timeout` does not mean that nothing was stored.
 */
export interface CatchUpChat {
  execute(q: { chat: ChatId; waitMs?: number }): Promise<
    | { kind: "fresh"; state: ChatStateView; newMessages: number }
    | { kind: "failed"; reason: "unreachable" | "credentials" | "quota" | "usage_limit" | "timeout" | "storage" }
    | { kind: "refused"; reason: "not_owner" }
  >;
}

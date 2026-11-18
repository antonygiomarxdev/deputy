import type { Instant } from "../../shared/instant";
import type { ChatStateView } from "./views";

/** The chats of the active world only. */
export interface ListChats {
  execute(q: { customerMessageSince?: Instant }): Promise<ChatStateView[]>;
}

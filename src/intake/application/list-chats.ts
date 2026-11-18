import type { Instant } from "../../shared/instant";
import type { ProviderName } from "../../shared/provider-name";
import type { IntakeRepos } from "../ports/intake-unit-of-work";
import type { ListChats } from "../ports/list-chats";
import type { ChatStateView } from "../ports/views";
import { toChatStateView } from "./chat-state-view";

export class ListChatsUseCase implements ListChats {
  constructor(private readonly d: { repos: Pick<IntakeRepos, "chats" | "messages">; provider: ProviderName }) {}

  async execute(q: { customerMessageSince?: Instant }): Promise<ChatStateView[]> {
    const dev = this.d.provider === "dev";
    const states = await this.d.repos.chats.list({
      dev,
      ...(q.customerMessageSince === undefined ? {} : { customerMessageSince: q.customerMessageSince }),
    });
    const unattributedStoredAt = await this.d.repos.messages.newestUnattributedStoredAt(dev);
    return states.map((s) => toChatStateView(s, unattributedStoredAt));
  }
}

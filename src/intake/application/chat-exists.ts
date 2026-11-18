import type { ChatId } from "../../shared/chat-id";
import type { ProviderName } from "../../shared/provider-name";
import type { ChatExists } from "../ports/chat-exists";
import type { IntakeRepos } from "../ports/intake-unit-of-work";

export class ChatExistsUseCase implements ChatExists {
  constructor(private readonly d: { repos: Pick<IntakeRepos, "messages">; provider: ProviderName }) {}

  async execute(q: { chat: ChatId }) {
    const found = await this.d.repos.messages.chatExists(q.chat);
    return { ...found, activeWorldIsDev: this.d.provider === "dev" };
  }
}

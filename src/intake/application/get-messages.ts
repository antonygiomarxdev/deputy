import type { MessageId } from "../../shared/message-id";
import type { GetMessages } from "../ports/get-messages";
import type { IntakeRepos } from "../ports/intake-unit-of-work";
import type { MessageView } from "../ports/views";
import { toMessageView } from "./message-view";

export class GetMessagesUseCase implements GetMessages {
  constructor(private readonly repos: Pick<IntakeRepos, "messages">) {}

  async execute(q: { ids: readonly MessageId[] }): Promise<MessageView[]> {
    return (await this.repos.messages.findMany(q.ids)).map(toMessageView);
  }
}

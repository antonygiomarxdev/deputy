import type { MessageId } from "../../shared/message-id";
import type { MessageView } from "./views";

/** Unknown ids are absent from the result. */
export interface GetMessages {
  execute(q: { ids: readonly MessageId[] }): Promise<MessageView[]>;
}

import type { ChatId } from "../../../shared/chat-id";
import type { Sender } from "../../ports/sender";

type Result = Awaited<ReturnType<Sender["send"]>>;

/** Records every call; answers `result` (sent by default) after running `beforeSend`. */
export class FakeSender implements Sender {
  readonly calls: { chat: ChatId; text: string; sendId: string }[] = [];
  result: Result = { kind: "sent" };
  beforeSend: () => Promise<void> = async () => {};

  async send(chat: ChatId, text: string, sendId: string): Promise<Result> {
    this.calls.push({ chat, text, sendId });
    await this.beforeSend();
    return this.result;
  }
}

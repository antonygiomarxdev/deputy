import type { ChatId } from "../../../shared/chat-id";
import { parseSendId } from "../../../shared/send-id";
import type { SendText } from "../../../intake/index";
import type { Sender } from "../../ports/sender";

/** The only caller of Intake's SendText. A one-to-one mapping: only the send id is converted, and the sent ids are dropped. */
export class IntakeSender implements Sender {
  constructor(private readonly intake: { sendText: SendText }) {}

  async send(chat: ChatId, text: string, sendId: string): ReturnType<Sender["send"]> {
    const id = parseSendId(sendId);
    // nothing was sent: an unusable send id never reaches the provider
    if (id === null) return { kind: "failed", reason: "rejected" };
    const r = await this.intake.sendText.execute({ sendId: id, chat, text });
    return r.kind === "sent" ? { kind: "sent" } : r;
  }
}

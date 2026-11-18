import type { Message } from "../domain/message";
import type { MessageView } from "../ports/views";

export function toMessageView(m: Message): MessageView {
  const p = m.props;
  return {
    id: p.id,
    chat: p.chat,
    sender: p.sender?.e164 ?? null,
    type: p.type,
    readable: p.readable,
    text: p.text,
    transcript: p.transcript,
    readerText: m.readerText(),
    sentAt: p.sentAt,
    storedAt: p.storedAt,
    source: p.source,
    history: p.history,
    dev: p.dev,
    edited: p.edited,
    previousTexts: m.versions.flatMap((v) => (v.text === null ? [] : [v.text])),
    deletedBySender: p.deletedBySender,
    mark: p.mark,
  };
}

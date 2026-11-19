import type { IntakeEvent, MessageStored } from "../domain/events";
import type { EventPublisher } from "../ports/event-publisher";

/** Each event is published on its own: a subscriber that throws must not stop the next one. */
export function publishEach(publisher: EventPublisher, events: readonly IntakeEvent[]): void {
  for (const e of events) {
    try {
      publisher.publish(e);
    } catch (err) {
      console.error(`deputy: a subscriber failed on ${e.name} (${err instanceof Error ? err.name : "unknown error"})`);
    }
  }
}

/** What a stored batch announces: MessageStored when anything was stored, OwnerReplyUnlinked when an owner reply had no chat. */
export function storedEvents(origin: MessageStored["origin"], items: MessageStored["items"], unlinked: number, at: number): IntakeEvent[] {
  const events: IntakeEvent[] = [];
  if (items.length > 0) events.push({ name: "MessageStored", origin, items, at });
  if (unlinked > 0) events.push({ name: "OwnerReplyUnlinked", at });
  return events;
}

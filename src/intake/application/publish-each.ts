import type { IntakeEvent } from "../domain/events";
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

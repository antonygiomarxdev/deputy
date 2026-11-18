import type { IntakeEvent } from "../../domain/events";
import type { EventPublisher } from "../../ports/event-publisher";

/** Test adapter: keeps what it got. */
export class RecordingEventPublisher implements EventPublisher {
  readonly published: IntakeEvent[] = [];

  publish(e: IntakeEvent): void {
    this.published.push(e);
  }
}

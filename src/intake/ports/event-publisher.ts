import type { IntakeEvent } from "../domain/events";

export interface EventPublisher {
  publish(e: IntakeEvent): void;
}

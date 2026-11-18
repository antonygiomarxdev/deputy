import type { Instant } from "../../shared/instant";
import type { DraftNumber } from "./draft";

export interface Approval {
  readonly id: string;
  readonly draftNumber: DraftNumber;
  readonly textVersion: number;
  readonly text: string;
  readonly textHash: string;
  readonly ownerWords: string;
  readonly approvedAt: Instant;
  readonly usedAt: Instant | null;
  readonly sendId: string;
  readonly voidedAt: Instant | null;
  readonly voidReason: string | null;
}

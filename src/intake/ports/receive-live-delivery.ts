import type { RejectionReason } from "../domain/rejection-note";

export interface ReceiveLiveDelivery {
  execute(req: { rawBody: Uint8Array; headers: ReadonlyMap<string, string> }): Promise<
    | { kind: "stored"; stored: number; duplicates: number; ignored: number }
    | { kind: "rejected"; reason: RejectionReason }
    | { kind: "storage_failed" }
    | { kind: "live_off" }
    | { kind: "refused"; reason: "not_owner" }
  >;
}

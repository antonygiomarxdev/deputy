import { describe, expect, test } from "bun:test";
import { STORED_REASONS, SyncState, type StoredReason } from "../../../src/intake/domain/sync-state";
import { openSqliteSubject } from "../../support/intake-subjects";

// Written out here, not read from STORED_REASONS: a value removed from the list must fail this test, not vanish from it.
const EVERY_REASON: readonly StoredReason[] = [
  "unreachable", "credentials", "quota", "usage_limit", "timeout", "bad_response", "possible_gap", "catching_up", "storage",
];

describe("every stored sync reason survives a SQLite round trip", () => {
  test("the reason list is exactly the expected one", () => {
    expect([...STORED_REASONS].sort()).toEqual([...EVERY_REASON].sort());
  });

  test("each reason is written and read back unchanged", async () => {
    const s = await openSqliteSubject();
    try {
      for (const reason of EVERY_REASON) {
        const state = SyncState.initial("kapso");
        state.begin({ providerTime: 1_000, now: 2_000 });
        state.fail(reason, 4_000);
        await s.repos.syncState.save(state);
        const loaded = await s.repos.syncState.load("kapso");
        expect({ reason, stored: loaded?.props.reason }).toEqual({ reason, stored: reason });
      }
    } finally {
      await s.cleanup();
    }
  });
});

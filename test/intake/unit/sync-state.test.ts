import { describe, expect, test } from "bun:test";
import { SyncState } from "../../../src/intake/domain/sync-state";

const MIN = 60_000;

describe("SyncState", () => {
  test("FR-INTAKE-03-6: a new state is not yet run", () => {
    expect(SyncState.initial("kapso").isNotYetRun()).toBe(true);
  });

  test("begin sets connectedAt once", () => {
    const s = SyncState.initial("kapso");
    s.begin({ providerTime: 1_000, now: 10 });
    s.begin({ providerTime: 9_000, now: 20 });
    expect(s.props).toMatchObject({ connectedAt: 1_000, lastAttemptAt: 20, runStartedAt: 20 });
    expect(s.isNotYetRun()).toBe(false);
  });

  test("the conversation mark never moves back", () => {
    const s = SyncState.initial("kapso");
    s.advanceConversations(100);
    s.advanceConversations(50);
    expect(s.props.markConversations).toBe(100);
    s.completeConversations(70);
    expect(s.props.markConversations).toBe(100);
    s.completeConversations(200);
    expect(s.props.markConversations).toBe(200);
  });

  test("outbound: resume is kept until completeOutbound, which moves the mark forward only", () => {
    const s = SyncState.initial("kapso");
    s.saveOutboundResume({ cursor: "c", from: 5, runStart: 9 });
    expect(s.props.outboundResume).toEqual({ cursor: "c", from: 5, runStart: 9 });
    s.completeOutbound(300);
    s.saveOutboundResume({ cursor: "d", from: null, runStart: 1 });
    s.completeOutbound(100);
    expect(s.props).toMatchObject({ markOutbound: 300, outboundResume: null });
  });

  test("complete clears the failure fields", () => {
    const s = SyncState.initial("kapso");
    s.setGap({ storedAt: 1, returnedAt: 2 });
    s.fail("usage_limit", 1_000, 30_000);
    s.complete(5_000);
    expect(s.props).toMatchObject({
      status: "complete",
      reason: null,
      lastSuccessAt: 5_000,
      failedSince: null,
      rateLimitedSince: null,
      retryAt: null,
      gap: null,
    });
  });

  test("usage_limit: retryAt, the streak start and when the owner is told", () => {
    const s = SyncState.initial("kapso");
    s.fail("usage_limit", 1_000, 30_000);
    expect(s.props).toMatchObject({ retryAt: 31_000, rateLimitedSince: 1_000, failedSince: 1_000 });
    expect(s.tellOwner(1_000 + 9 * MIN)).toBe(false);
    expect(s.tellOwner(1_000 + 10 * MIN)).toBe(true);
    const d = SyncState.initial("kapso");
    d.fail("usage_limit", 1_000, null);
    expect(d.props.retryAt).toBe(61_000);
  });

  test("a streak keeps its start; another reason clears retryAt and is always told", () => {
    const s = SyncState.initial("kapso");
    s.fail("usage_limit", 1_000, 1_000);
    s.fail("usage_limit", 5_000, 1_000);
    expect(s.props).toMatchObject({ rateLimitedSince: 1_000, failedSince: 1_000, retryAt: 6_000 });
    s.fail("unreachable", 6_000);
    expect(s.props.retryAt).toBeNull();
    expect(s.tellOwner(6_000)).toBe(true);
  });

  test("a complete state tells nobody", () => {
    const s = SyncState.initial("kapso");
    s.complete(1);
    expect(s.tellOwner(10 * MIN)).toBe(false);
  });

  test("countStored adds only before the first success", () => {
    const s = SyncState.initial("kapso");
    s.countStored(3);
    s.countStored(2);
    expect(s.props.firstImportCount).toBe(5);
    s.complete(10);
    s.countStored(4);
    expect(s.props.firstImportCount).toBe(5);
  });
});

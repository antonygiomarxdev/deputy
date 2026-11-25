// covers: intake/FRD-03/EX-15
// covers: intake/FRD-03/EX-16
// covers: intake/FRD-03/EX-17
// covers: intake/FRD-03/EX-18
import { describe, expect, test } from "bun:test";
import { probeGap, type ListingRead } from "../../../src/intake/application/gap-probe";
import type { MessageRepositoryGap } from "../../../src/intake/ports/message-repository";

const DAY = 86_400_000;
const NOW = 100 * DAY;
const conversation: ListingRead = { scope: { conversationRef: "c1" }, exhausted: true, oldestReturned: NOW - 3 * DAY };
const outbound = (oldest: number | null): ListingRead => ({ scope: { ownerOrDeputy: true }, exhausted: true, oldestReturned: oldest });
// the stored side: whatever is stored older than O, in any scope
const stored = (at: number | null): MessageRepositoryGap => ({
  newestStoredBefore: async () => at,
  newestStoredAt: async () => null,
  oldestStoredAt: async () => null,
});

describe("the gap probe and the pre-run coverage mark (FR-INTAKE-03-15, SPEC-03 Task 5)", () => {
  test("(c) boundary: a pre-run mark exactly at O means O was already read, so no gap", async () => {
    const r = await probeGap({
      listings: [conversation],
      marksBefore: { conversations: NOW - 3 * DAY, outbound: null },
      messages: stored(NOW - 10 * DAY),
      provider: "kapso",
    });
    expect(r).toBeNull();
  });

  test("(c) a mark just before O is still a gap", async () => {
    const r = await probeGap({
      listings: [conversation],
      marksBefore: { conversations: NOW - 3 * DAY - 1, outbound: null },
      messages: stored(NOW - 10 * DAY),
      provider: "kapso",
    });
    expect(r).toEqual({ storedAt: NOW - 10 * DAY, returnedAt: NOW - 3 * DAY });
  });

  test("(f) a null pre-run mark, before the first catch-up, with an older stored message is a gap", async () => {
    const r = await probeGap({
      listings: [conversation],
      marksBefore: { conversations: null, outbound: null },
      messages: stored(NOW - 10 * DAY),
      provider: "kapso",
    });
    expect(r).toEqual({ storedAt: NOW - 10 * DAY, returnedAt: NOW - 3 * DAY });
  });

  test("(e) each scope is read against its own mark: the conversation covered, the outbound scope not", async () => {
    const onlyOutbound = await probeGap({
      listings: [conversation, outbound(NOW - 4 * DAY)],
      marksBefore: { conversations: NOW - 2 * DAY, outbound: null },
      messages: stored(NOW - 10 * DAY),
      provider: "kapso",
    });
    expect(onlyOutbound).toEqual({ storedAt: NOW - 10 * DAY, returnedAt: NOW - 4 * DAY });

    const onlyConversation = await probeGap({
      listings: [conversation, outbound(NOW - 4 * DAY)],
      marksBefore: { conversations: null, outbound: NOW - 2 * DAY },
      messages: stored(NOW - 10 * DAY),
      provider: "kapso",
    });
    expect(onlyConversation).toEqual({ storedAt: NOW - 10 * DAY, returnedAt: NOW - 3 * DAY });
  });
});

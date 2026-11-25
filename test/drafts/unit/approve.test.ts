import { describe, expect, test } from "bun:test";
import { Draft, type DraftKind, type DraftState } from "../../../src/drafts/domain/draft";
import type { ChatId } from "../../../src/shared/chat-id";

const chat = "chat-a" as ChatId;
const mid = { provider: "dev", providerMessageId: "m1" } as const;

function draft(kind: DraftKind = "reply", state: DraftState = "waiting", shown: boolean | number = true): Draft {
  const r = Draft.propose({
    number: 3, kind, chat, text: "Hello", now: 1_000, dev: false, answers: kind === "reply" ? mid : null,
    basis: { messageId: mid, sentAt: 900 }, checkedStoredAt: 950, orderPayload: kind === "order" ? "{}" : null,
  });
  if (!("draft" in r)) throw new Error("fixture refused");
  const s = r.draft.snapshot();
  const shownVersion = shown === true ? s.textVersion : shown === false ? null : shown;
  return Draft.rehydrate({ ...s, state, shownVersion });
}

const go = (over: Partial<Parameters<Draft["approve"]>[0]> = {}) => ({
  shownText: "Hello", ownerWords: "go 3", approvalId: "ap1", sendId: "deputy:ap1", textHash: "hash", now: 2_000, ...over,
});

describe("approve", () => {
  // covers: drafts/FRD-02/EX-5
  test("FR-DRAFTS-02-3: a shown draft with the exact text gives a used Approval and the Approved event", () => {
    const d = draft();
    const r = d.approve(go());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.approval).toEqual({
      id: "ap1", draftNumber: 3, textVersion: 1, text: "Hello", textHash: "hash", ownerWords: "go 3",
      approvedAt: 2_000, usedAt: 2_000, sendId: "deputy:ap1", voidedAt: null, voidReason: null,
    });
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({ type: "Approved", approvalId: "ap1", sendId: "deputy:ap1", proposedText: "Hello", text: "Hello", ownerWords: "go 3" });
    expect(d.snapshot().state).toBe("waiting");
  });

  test("FR-DRAFTS-02-3: a different text is text_differs; a draft not shown, or shown at an older version, is not_shown", () => {
    expect(draft().approve(go({ shownText: "Hello!" }))).toEqual({ ok: false, reason: "text_differs" });
    expect(draft("reply", "waiting", false).approve(go())).toEqual({ ok: false, reason: "not_shown" });
    const d = draft("reply", "waiting", true);
    d.changeText({ text: "v2", orderPayload: null, ownerWords: "w", now: 1_500 });
    expect(d.approve(go({ shownText: "v2" }))).toEqual({ ok: false, reason: "not_shown" });
  });

  test("a draft that holds a live approval is not approved again; a voided one is replaced", () => {
    const d = draft();
    expect(d.approve(go()).ok).toBe(true);
    expect(d.approve(go({ approvalId: "ap2", sendId: "deputy:ap2" }))).toEqual({ ok: false, reason: "already_approved" });
    const held = d.snapshot().approval;
    if (!held) throw new Error("no approval");
    expect(held.id).toBe("ap1");
    const voided = Draft.rehydrate({ ...d.snapshot(), approval: { ...held, voidedAt: 3_000, voidReason: "changed" } });
    expect(voided.approve(go({ approvalId: "ap2", sendId: "deputy:ap2" })).ok).toBe(true);
  });

  test.each(["held", "failed", "unknown"] as const)("a %s draft can be approved", (state) => {
    expect(draft("reply", state).approve(go()).ok).toBe(true);
  });

  test.each(["sent", "recorded", "rejected", "replaced"] as const)("FR-DRAFTS-02-5, -8: a %s draft is closed", (state) => {
    expect(draft("reply", state).approve(go())).toEqual({ ok: false, reason: "closed" });
  });

  test.each(["sending", "recording"] as const)("FR-DRAFTS-02-5: a %s draft is in_flight", (state) => {
    expect(draft("reply", state).approve(go())).toEqual({ ok: false, reason: "in_flight" });
  });
});

describe("the send path", () => {
  test("FR-DRAFTS-02-12: approve then startSending gives sending for a reply and recording for an order; never approved", () => {
    for (const [kind, state] of [["reply", "sending"], ["order", "recording"]] as const) {
      const d = draft(kind);
      expect(d.approve(go()).ok).toBe(true);
      expect(d.snapshot().state).toBe("waiting");
      const r = d.startSending(2_100);
      expect(r.ok && r.events[0]).toMatchObject({ type: "SendStarted", sendId: "deputy:ap1", text: "Hello" });
      expect(d.snapshot().state).toBe(state);
    }
  });

  test("startSending without an approval is not_approvable", () => {
    expect(draft().startSending(1)).toEqual({ ok: false, reason: "not_approvable" });
  });

  test("finishSent closes a sending draft, and an unknown draft too", () => {
    for (const state of ["sending", "unknown"] as const) {
      const d = draft("reply", state);
      const r = d.finishSent({ sendId: "deputy:ap1", now: 3_000, reason: state === "unknown" ? "found_after_unknown" : null });
      expect(r.ok && r.events[0]).toMatchObject({ type: "DraftSent", sendId: "deputy:ap1", text: "Hello" });
      expect(d.snapshot()).toMatchObject({ state: "sent", closedAt: 3_000 });
    }
    expect(draft("reply", "waiting").finishSent({ sendId: "s", now: 1, reason: null })).toEqual({ ok: false, reason: "not_approvable" });
  });

  test("FR-DRAFTS-02-9: finishRecorded stores the order id and closes the draft", () => {
    const d = draft("order", "recording");
    const r = d.finishRecorded({ orderId: "o-9", now: 3_000 });
    expect(r.ok && r.events[0]).toMatchObject({ type: "OrderRecorded", orderId: "o-9" });
    expect(d.snapshot()).toMatchObject({ state: "recorded", orderId: "o-9", closedAt: 3_000 });
    expect(draft("order", "sending").finishRecorded({ orderId: "o", now: 1 })).toEqual({ ok: false, reason: "not_approvable" });
  });

  test.each([
    ["finishFailed", "failed", "SendFailed"],
    ["finishUnknown", "unknown", "OutcomeUnknown"],
  ] as const)("FR-DRAFTS-02-9: %s stores the reason, clears shownVersion and emits %s", (method, state, event) => {
    for (const from of ["sending", "recording"] as const) {
      const d = draft("reply", from);
      const r = d[method]({ reason: "quota", now: 3_000 });
      expect(r.ok && r.events[0]).toMatchObject({ type: event, reason: "quota" });
      expect(d.snapshot()).toMatchObject({ state, failReason: "quota", shownVersion: null });
    }
    expect(draft("reply", "waiting")[method]({ reason: "x", now: 1 })).toEqual({ ok: false, reason: "not_approvable" });
  });

  test("a change that voids an approval carries its send id", () => {
    const d = draft();
    d.approve(go());
    const r = d.changeText({ text: "v2", orderPayload: null, ownerWords: "w", now: 2_500 });
    expect(r.ok && r.events.map((e) => e.type)).toEqual(["TextChanged", "ApprovalVoided"]);
    expect(r.ok && r.events[1]).toMatchObject({ sendId: "deputy:ap1" });
  });
});

// covers: drafts/FRD-01/EX-1
// covers: drafts/FRD-01/EX-2
// covers: drafts/FRD-01/EX-9
// covers: drafts/FRD-01/EX-10
// covers: drafts/FRD-01/EX-11
// covers: drafts/FRD-01/EX-12
// covers: drafts/FRD-01/EX-13
// covers: drafts/FRD-01/EX-14
// covers: drafts/FRD-01/EX-15
// covers: drafts/FRD-01/EX-16
// covers: drafts/FRD-01/EX-20
import { describe, expect, test } from "bun:test";
import { Draft, type DraftSnapshot, type DraftState } from "../../../src/drafts/domain/draft";
import type { Approval } from "../../../src/drafts/domain/approval";
import { refusalText, type Refusal } from "../../../src/drafts/domain/refusals";
import type { ChatId } from "../../../src/shared/chat-id";
import type { MessageId } from "../../../src/shared/message-id";

const chat = "chat-a" as ChatId;
const answered: MessageId = { provider: "dev", providerMessageId: "m1" };
const input = (text: string, number = 5) => ({
  number,
  kind: "reply" as const,
  chat,
  text,
  now: 1000,
  dev: true,
  answers: answered,
  basis: { messageId: answered, sentAt: 900 },
  checkedStoredAt: 950,
  orderPayload: null,
});

function propose(text = "Hello") {
  const r = Draft.propose(input(text));
  if (!("draft" in r)) throw new Error("propose refused");
  return r;
}

const liveApproval = (n: number): Approval => ({
  id: "ap1",
  draftNumber: n,
  textVersion: 1,
  text: "Hello",
  textHash: "h",
  ownerWords: "go 5",
  approvedAt: 1100,
  usedAt: null,
  sendId: "s1",
  voidedAt: null,
  voidReason: null,
});

function inState(state: DraftState, approval: Approval | null = null, shownVersion: number | null = null): Draft {
  return Draft.rehydrate({ ...propose().draft.snapshot(), state, approval, shownVersion });
}

const change = (text: string) => ({ text, orderPayload: null, ownerWords: "w", now: 1200 });

describe("FR-DRAFTS-01-1 and -2", () => {
  test("propose keeps the text byte for byte, version 1, waiting, one DraftProposed event", () => {
    const text = "  Hi there\nsecond line";
    const { draft, events } = propose(text);
    const s = draft.snapshot();
    expect(s.currentText).toBe(text);
    expect(s.proposedText).toBe(text);
    expect(s.number).toBe(5);
    expect(s.textVersion).toBe(1);
    expect(s.state).toBe("waiting");
    expect(events.map((e) => e.type)).toEqual(["DraftProposed"]);
    expect(events[0]).toMatchObject({ draft: 5, chat, text, answersMessageId: "dev:m1" });
  });
  test("the number stays after changeText", () => {
    const { draft } = propose();
    draft.changeText(change("New"));
    expect(draft.snapshot().number).toBe(5);
  });
  test.each(["", "   \n\t"])("empty text %p is refused", (text) => {
    expect(Draft.propose(input(text))).toEqual({ ok: false, reason: "empty_text" });
  });
  test("normalized copies are filled", () => {
    const s = propose("Hello  WORLD").draft.snapshot();
    expect(s.proposedNorm).toBe(s.currentNorm);
    expect(s.proposedNorm).not.toBe("");
  });
});

describe("FR-DRAFTS-01-5", () => {
  test("changeText with a live approval voids it", () => {
    const d = inState("waiting", liveApproval(5), 1);
    const r = d.changeText(change("Edited"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.events.map((e) => e.type)).toEqual(["TextChanged", "ApprovalVoided"]);
      expect(r.events[1]).toMatchObject({ reason: "changed", approvalId: "ap1" });
    }
    const s: DraftSnapshot = d.snapshot();
    expect(s.state).toBe("waiting");
    expect(s.textVersion).toBe(2);
    expect(s.shownVersion).toBeNull();
    expect(s.currentText).toBe("Edited");
    expect(s.proposedText).toBe("Hello");
  });
  test("changeText without an approval emits only TextChanged and brings a held draft back to waiting", () => {
    const d = inState("held");
    const r = d.changeText(change("Edited"));
    expect(r.ok && r.events.map((e) => e.type)).toEqual(["TextChanged"]);
    expect(d.snapshot().state).toBe("waiting");
  });
  test("blank new text is refused and nothing changes", () => {
    const d = propose().draft;
    expect(d.changeText(change("  "))).toEqual({ ok: false, reason: "empty_text" });
    expect(d.snapshot().textVersion).toBe(1);
  });
});

describe("FR-DRAFTS-01-6", () => {
  test("reject closes the draft and every later change is refused as closed", () => {
    const d = propose().draft;
    const r = d.reject({ ownerWords: "no 5", now: 1500 });
    expect(r.ok && r.events.map((e) => e.type)).toEqual(["DraftRejected"]);
    const s = d.snapshot();
    expect(s.state).toBe("rejected");
    expect(s.closedAt).toBe(1500);
    const closed = { ok: false, reason: "closed" } as const;
    expect(d.changeText(change("x"))).toEqual(closed);
    expect(d.reject({ ownerWords: "w", now: 1 })).toEqual(closed);
    expect(d.replaceBy({ number: 9, now: 1 })).toEqual(closed);
  });
  test.each(["sent", "recorded", "replaced"] as const)("a %s draft refuses everything as closed", (state) => {
    const d = inState(state);
    expect(d.reject({ ownerWords: "w", now: 1 })).toEqual({ ok: false, reason: "closed" });
  });
});

describe("FR-DRAFTS-01-7", () => {
  test("replaceBy with a live approval", () => {
    const d = inState("waiting", liveApproval(5));
    const r = d.replaceBy({ number: 7, now: 2000 });
    expect(r.ok && r.events.map((e) => e.type)).toEqual(["DraftReplaced", "ApprovalVoided"]);
    if (r.ok) expect(r.events[1]).toMatchObject({ reason: "replaced" });
    const s = d.snapshot();
    expect(s.state).toBe("replaced");
    expect(s.replacedBy).toBe(7);
    expect(s.closedAt).toBe(2000);
  });
  test.each(["sending", "recording"] as const)("a %s draft refuses changeText, reject and replaceBy as in_flight", (state) => {
    const d = inState(state);
    const f = { ok: false, reason: "in_flight" } as const;
    expect(d.replaceBy({ number: 7, now: 1 })).toEqual(f);
    expect(d.changeText(change("x"))).toEqual(f);
    expect(d.reject({ ownerWords: "w", now: 1 })).toEqual(f);
    expect(d.snapshot().state).toBe(state);
  });
  test("an unknown draft refuses changeText and replaceBy but can be rejected", () => {
    const d = inState("unknown");
    const f = { ok: false, reason: "unknown_open" } as const;
    expect(d.changeText(change("x"))).toEqual(f);
    expect(d.replaceBy({ number: 7, now: 1 })).toEqual(f);
    expect(d.reject({ ownerWords: "w", now: 1 }).ok).toBe(true);
    expect(d.snapshot().state).toBe("rejected");
  });
});

describe("markShown", () => {
  test("sets shownVersion once, and again after a text change", () => {
    const d = propose().draft;
    expect(d.markShown()).toBe(true);
    expect(d.snapshot().shownVersion).toBe(1);
    expect(d.markShown()).toBe(false);
    d.changeText(change("v2"));
    expect(d.markShown()).toBe(true);
  });
});

describe("Language (D20)", () => {
  const sample: Refusal[] = [
    { code: "not_owner" },
    { code: "chat_not_found" },
    { code: "no_customer_message" },
    { code: "dev_messages_only" },
    { code: "empty_text" },
    { code: "order_rejected", reasons: ["no stock", "bad qty"] },
    { code: "send_in_progress", number: 3 },
    { code: "outcome_unknown_open", number: 3 },
    { code: "draft_not_found", number: 3 },
    { code: "draft_closed", number: 3, state: "sent" },
    { code: "wrong_kind", number: 3 },
    { code: "words_empty" },
    { code: "log_unavailable" },
    { code: "stale_draft", number: 3 },
  ];
  test.each(sample)("refusal $code has English text", (r) => {
    expect(refusalText(r).length).toBeGreaterThan(0);
  });
  test("texts name the draft number and state where the code carries them", () => {
    expect(refusalText({ code: "draft_closed", number: 3, state: "sent" })).toBe("draft 3 is closed (sent)");
    expect(refusalText({ code: "order_rejected", reasons: ["a", "b"] })).toBe("the order was refused: a; b");
  });
});

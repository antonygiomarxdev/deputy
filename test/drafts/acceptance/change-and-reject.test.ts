import { describe, expect, test } from "bun:test";
import { ChangeDraftUseCase } from "../../../src/drafts/application/change-draft";
import { RejectDraftUseCase } from "../../../src/drafts/application/reject-draft";
import type { Approval } from "../../../src/drafts/domain/approval";
import { Draft, type DraftSnapshot, type DraftState } from "../../../src/drafts/domain/draft";
import type { Refusal } from "../../../src/drafts/domain/refusals";
import type { Transaction, UnitOfWork } from "../../../src/drafts/ports/outbound";
import type { ChatId } from "../../../src/shared/chat-id";
import { InMemoryOwnerLease } from "../../support/in-memory-owner-lease";
import { makeDrafts, message } from "./harness";

const chat = "chat-a" as ChatId;
const question = [message("m1", "customer", "How much is the cake?", 900)];

const liveApproval: Approval = {
  id: "ap-1",
  draftNumber: 1,
  textVersion: 1,
  text: "old",
  textHash: "hash",
  ownerWords: "yes, send it",
  approvedAt: 600,
  usedAt: null,
  sendId: "send-1",
  voidedAt: null,
  voidReason: null,
};

/** Approvals are stored by SPEC-02; until then a unit of work can hand one to a loaded draft. */
function withApproval(inner: UnitOfWork, approval: Approval): UnitOfWork {
  return {
    read: (work) => inner.read(work),
    run: (work, options) =>
      inner.run(
        (tx) =>
          work({
            log: tx.log,
            drafts: {
              ...tx.drafts,
              get: async (n) => {
                const d = await tx.drafts.get(n);
                return d === null ? null : Draft.rehydrate({ ...d.snapshot(), approval });
              },
            },
          } satisfies Transaction),
        options,
      ),
  };
}

function setup(unitOfWork?: (inner: UnitOfWork) => UnitOfWork) {
  const h = makeDrafts({ chats: { "chat-a": question } });
  const lease = new InMemoryOwnerLease(h.holder, h.clock, "me");
  const uow = unitOfWork ? unitOfWork(h.store.unitOfWork) : h.store.unitOfWork;
  const change = new ChangeDraftUseCase({ clock: h.clock, lease, unitOfWork: uow, orders: h.orders });
  const reject = new RejectDraftUseCase({ clock: h.clock, lease, unitOfWork: uow });
  return { h, change, reject };
}

async function seed(h: ReturnType<typeof makeDrafts>, state: DraftState, over: Partial<DraftSnapshot> = {}) {
  const r = Draft.propose({
    number: 1, kind: "reply", chat, text: "old", now: 500, dev: false, answers: null,
    basis: { messageId: { provider: "dev", providerMessageId: "m1" }, sentAt: 900 }, checkedStoredAt: 500, orderPayload: null,
  });
  if (!("draft" in r)) throw new Error("fixture refused");
  const d = Draft.rehydrate({ ...r.draft.snapshot(), state, ...over });
  await h.store.unitOfWork.run(async (tx) => {
    await tx.drafts.nextNumber();
    await tx.drafts.save(d);
  });
}

const stored = async (h: ReturnType<typeof makeDrafts>, n = 1) =>
  (await h.store.unitOfWork.run((tx) => tx.drafts.get(n), { requireLease: false }))?.snapshot();
const logKinds = async (h: ReturnType<typeof makeDrafts>) => (await h.store.log.page({ after: 0, limit: 50 })).map((e) => e.kind);

function refusal(r: { ok: boolean; refusal?: Refusal }): Refusal {
  if (r.ok || r.refusal === undefined) throw new Error("expected a refusal");
  return r.refusal;
}

describe("ChangeDraft", () => {
  test("FR-DRAFTS-01-5: a held draft goes back to waiting; the log keeps the proposed text, the new text and the owner's words", async () => {
    const { h, change } = setup();
    await seed(h, "held");
    const out = await change.run({ number: 1, text: "new text", ownerWords: "  make it shorter " });
    expect(out).toEqual({ ok: true, value: { number: 1, state: "waiting", approvalVoided: false } });
    expect(await stored(h)).toMatchObject({ state: "waiting", currentText: "new text", proposedText: "old", textVersion: 2 });
    const [entry] = await h.store.log.page({ after: 0, limit: 10 });
    expect(entry).toMatchObject({ kind: "text_changed", proposedText: "old", finalText: "new text", ownerWords: "make it shorter" });
  });

  test("FR-DRAFTS-01-5: a live approval is voided and logged", async () => {
    const { h, change } = setup((inner) => withApproval(inner, liveApproval));
    await seed(h, "waiting");
    const out = await change.run({ number: 1, text: "new text", ownerWords: "change it" });
    expect(out).toMatchObject({ ok: true, value: { approvalVoided: true } });
    expect(await logKinds(h)).toEqual(["text_changed", "approval_voided"]);
  });

  test("FR-DRAFTS-01-3: a change clears the shown version, so the next ListDrafts shows the new text", async () => {
    const { h, change } = setup();
    await seed(h, "waiting", { shownVersion: 1 });
    expect((await stored(h))?.shownVersion).toBe(1);
    await change.run({ number: 1, text: "new text", ownerWords: "edit" });
    expect(await stored(h)).toMatchObject({ shownVersion: null, textVersion: 2 });
  });

  describe("an order draft", () => {
    async function orderDraft() {
      const s = setup();
      const made = await s.h.createDraft.run({ kind: "order", chat: "chat-a", order: { summary: "2 cakes" } });
      if (!made.ok) throw new Error("order draft refused");
      return { ...s, number: made.value.number };
    }

    test("FR-DRAFTS-01-5: a new order is prepared again and its summary and payload are stored", async () => {
      const { h, change, number } = await orderDraft();
      const out = await change.run({ number, order: { summary: "3 cakes" }, ownerWords: "three please" });
      expect(out.ok).toBe(true);
      expect(await stored(h, number)).toMatchObject({ currentText: "3 cakes", orderPayload: JSON.stringify({ summary: "3 cakes" }) });
    });

    test("a text on an order draft, an order on a reply draft, or neither is wrong_kind", async () => {
      const { h, change, number } = await orderDraft();
      expect(refusal(await change.run({ number, text: "hi", ownerWords: "x" }))).toEqual({ code: "wrong_kind", number });
      expect(refusal(await change.run({ number, ownerWords: "x" }))).toEqual({ code: "wrong_kind", number });
      await seed(h, "waiting", { number: 5, chat: "chat-b" as ChatId });
      expect(refusal(await change.run({ number: 5, order: { summary: "x" }, ownerWords: "x" }))).toEqual({ code: "wrong_kind", number: 5 });
    });

    test("a refused order is order_rejected and changes nothing", async () => {
      const { h, change, number } = await orderDraft();
      const out = await change.run({ number, order: { fail: "out of stock" }, ownerWords: "x" });
      expect(refusal(out)).toEqual({ code: "order_rejected", reasons: ["out of stock"] });
      expect((await stored(h, number))?.currentText).toBe("2 cakes");
    });
  });

  test("a blank reply text is empty_text", async () => {
    const { h, change } = setup();
    await seed(h, "waiting");
    expect(refusal(await change.run({ number: 1, text: "   ", ownerWords: "x" }))).toEqual({ code: "empty_text" });
    expect((await stored(h))?.textVersion).toBe(1);
  });
});

describe("RejectDraft", () => {
  test("FR-DRAFTS-01-6: a waiting draft is rejected, logged with the owner's words, and no longer listed; later changes are draft_closed", async () => {
    const { h, change, reject } = setup();
    await seed(h, "waiting");
    const out = await reject.run({ number: 1, ownerWords: "not now" });
    expect(out).toEqual({ ok: true, value: { number: 1, state: "rejected" } });
    const [entry] = await h.store.log.page({ after: 0, limit: 10 });
    expect(entry).toMatchObject({ kind: "rejected", ownerWords: "not now" });
    expect(await h.store.unitOfWork.run((tx) => tx.drafts.listOpen(), { requireLease: false })).toEqual([]);
    expect(refusal(await change.run({ number: 1, text: "x", ownerWords: "y" }))).toEqual({ code: "draft_closed", number: 1, state: "rejected" });
  });

  test("a live approval is voided when a draft is rejected", async () => {
    const { h, reject } = setup((inner) => withApproval(inner, liveApproval));
    await seed(h, "waiting");
    await reject.run({ number: 1, ownerWords: "no" });
    expect(await logKinds(h)).toEqual(["rejected", "approval_voided"]);
  });
});

describe("both use cases", () => {
  const both = (s: ReturnType<typeof setup>, number: number) => [
    () => s.change.run({ number, text: "x", ownerWords: "w" }),
    () => s.reject.run({ number, ownerWords: "w" }),
  ];

  test("FR-DRAFTS-01-6: an unknown draft is draft_not_found and changes nothing", async () => {
    const s = setup();
    for (const run of both(s, 4)) expect(refusal(await run())).toEqual({ code: "draft_not_found", number: 4 });
    expect(await logKinds(s.h)).toEqual([]);
  });

  test.each(["sent", "rejected", "replaced"] as const)("FR-DRAFTS-01-6: a %s draft is draft_closed with its state", async (state) => {
    const s = setup();
    await seed(s.h, state);
    for (const run of both(s, 1)) expect(refusal(await run())).toEqual({ code: "draft_closed", number: 1, state });
  });

  test("FR-DRAFTS-01-6: a sending draft is send_in_progress", async () => {
    const s = setup();
    await seed(s.h, "sending");
    for (const run of both(s, 1)) expect(refusal(await run())).toEqual({ code: "send_in_progress", number: 1 });
  });

  test("FR-DRAFTS-01-6: an unknown outcome blocks a change but can be rejected", async () => {
    const s = setup();
    await seed(s.h, "unknown");
    expect(refusal(await s.change.run({ number: 1, text: "x", ownerWords: "w" }))).toEqual({ code: "outcome_unknown_open", number: 1 });
    expect(await s.reject.run({ number: 1, ownerWords: "w" })).toEqual({ ok: true, value: { number: 1, state: "rejected" } });
  });

  test("FR-DRAFTS-01-5: without the lease both return not_owner", async () => {
    const s = setup();
    await seed(s.h, "waiting");
    s.h.holder.token = "someone else";
    for (const run of both(s, 1)) expect(refusal(await run())).toEqual({ code: "not_owner" });
    expect((await stored(s.h))?.state).toBe("waiting");
  });

  test.each([["empty", ""], ["spaces", "    "], ["too long", "x".repeat(1_001)]])(
    "FR-DRAFTS-01-6: owner words that are %s give words_empty and leave the draft unchanged",
    async (_name, words) => {
      const s = setup();
      await seed(s.h, "waiting");
      expect(refusal(await s.change.run({ number: 1, text: "x", ownerWords: words }))).toEqual({ code: "words_empty" });
      expect(refusal(await s.reject.run({ number: 1, ownerWords: words }))).toEqual({ code: "words_empty" });
      expect(await stored(s.h)).toMatchObject({ state: "waiting", currentText: "old", textVersion: 1 });
      expect(await logKinds(s.h)).toEqual([]);
    },
  );
});

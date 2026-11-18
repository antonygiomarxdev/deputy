import { describe, expect, test } from "bun:test";
import { Draft, type DraftState } from "../../../src/drafts/domain/draft";
import { LogUnavailable } from "../../../src/drafts/domain/errors";
import type { DraftLogRepository } from "../../../src/drafts/ports/log";
import type { ChatId } from "../../../src/shared/chat-id";
import { makeDrafts, message } from "./harness";

const chats = {
  "chat-a": [message("a1", "customer", "How much is the cake?", 900)],
  "chat-b": [message("b1", "customer", "Do you deliver?", 910)],
  "chat-c": [message("c1", "customer", "Are you open?", 920)],
};

type H = ReturnType<typeof makeDrafts>;

/** Three waiting drafts, listed first (listing sets the shown mark), as the owner flow does. */
async function threeListed(h: H) {
  for (const [chat, text] of [["chat-a", "ten"], ["chat-b", "yes"], ["chat-c", "from nine"]] as const) {
    await h.createDraft.run({ kind: "reply", chat, text });
  }
  await h.listDrafts.run({});
}

const approve = (h: H, number: number, words: string, shownText?: string) =>
  h.approveDraft.run({ number, shownText: shownText ?? ["ten", "yes", "from nine"][number - 1] ?? "", ownerWords: words });
const draftOf = async (h: H, n: number) => (await h.store.unitOfWork.run((tx) => tx.drafts.get(n), { requireLease: false }))?.snapshot();
const code = (r: { ok: boolean; refusal?: { code: string } }) => (r.ok ? "ok" : r.refusal?.code);
const approvals = (h: H, n: number) => h.store.unitOfWork.run((tx) => tx.approvals.forDraft(n), { requireLease: false });

describe("FR-DRAFTS-02-1 and -4", () => {
  test("one go names two drafts: each call succeeds with its own approval and words; draft 2 still waits", async () => {
    const h = makeDrafts({ chats });
    await threeListed(h);
    expect((await approve(h, 1, "go on 1 and 3")).ok).toBe(true);
    expect((await approve(h, 3, "go on 1 and 3")).ok).toBe(true);
    expect((await approvals(h, 1))[0]).toMatchObject({ draftNumber: 1, text: "ten", ownerWords: "go on 1 and 3", sendId: "deputy:ap1" });
    expect((await approvals(h, 3))[0]).toMatchObject({ draftNumber: 3, ownerWords: "go on 1 and 3" });
    expect((await draftOf(h, 2))?.state).toBe("waiting");
    expect(h.sender.calls.map((c) => c.text)).toEqual(["ten", "from nine"]);
  });

  test("words that name only draft 1 do not approve draft 2; there is no approve-everything", async () => {
    const h = makeDrafts({ chats });
    await threeListed(h);
    await approve(h, 1, "go 1");
    expect(code(await approve(h, 2, "go 1"))).toBe("words_missing_number");
    expect(code(await approve(h, 2, "approve everything from now on"))).toBe("words_missing_number");
    expect(h.sender.calls).toHaveLength(1);
  });
});

describe("FR-DRAFTS-02-2, -3, -5", () => {
  test("the words ok are words_missing_number: nothing approved, sent or stored", async () => {
    const h = makeDrafts({ chats });
    await threeListed(h);
    expect(await approve(h, 1, "ok")).toEqual({ ok: false, refusal: { code: "words_missing_number", number: 1 } });
    expect(h.sender.calls).toHaveLength(0);
    expect(await approvals(h, 1)).toEqual([]);
    expect((await draftOf(h, 1))?.state).toBe("waiting");
  });

  test("a shown text that differs is text_differs; a draft not listed after its change is not_shown", async () => {
    const h = makeDrafts({ chats });
    await threeListed(h);
    expect(code(await approve(h, 1, "go 1", "ten!"))).toBe("text_differs");
    await h.store.unitOfWork.run(async (tx) => {
      const d = await tx.drafts.get(1);
      d?.changeText({ text: "eleven", orderPayload: null, ownerWords: "w", now: 5_000 });
      if (d) await tx.drafts.save(d);
    });
    expect(code(await approve(h, 1, "go 1", "eleven"))).toBe("not_shown");
    expect(h.sender.calls).toHaveLength(0);
  });

  test("an unknown draft is draft_not_found; empty words are words_empty", async () => {
    const h = makeDrafts({ chats });
    await threeListed(h);
    expect(code(await approve(h, 9, "go 9", "x"))).toBe("draft_not_found");
    expect(code(await approve(h, 1, "   "))).toBe("words_empty");
  });

  test("an approved draft sends exactly the approved text with the send id deputy: plus the approval id", async () => {
    const h = makeDrafts({ chats });
    await threeListed(h);
    const out = await approve(h, 1, "go 1");
    expect(out).toEqual({ ok: true, value: { outcome: "sent", number: 1, sendId: "deputy:ap1", logged: true } });
    expect(h.sender.calls).toEqual([{ chat: "chat-a" as ChatId, text: "ten", sendId: "deputy:ap1" }]);
    expect(await draftOf(h, 1)).toMatchObject({ state: "sent" });
    const kinds = (await h.store.log.page({ after: 0, limit: 50 })).filter((e) => e.draft === 1).map((e) => e.kind);
    expect(kinds).toEqual(["proposed", "approved", "sending", "sent"]);
  });

  test("not the owner: refused, and the lease lost between the pre-checks and transaction 1 sends nothing", async () => {
    const h = makeDrafts({ chats });
    await threeListed(h);
    h.holder.token = "other";
    expect(code(await approve(h, 1, "go 1"))).toBe("not_owner");
    h.holder.token = "me";
    h.customerText.onCheck = () => {
      h.holder.token = "other";
    };
    expect(code(await approve(h, 1, "go 1"))).toBe("not_owner");
    expect(h.sender.calls).toHaveLength(0);
    expect(await approvals(h, 1)).toEqual([]);
  });
});

describe("FR-DRAFTS-02-6", () => {
  test("words equal to a customer message are words_copied customer; equal to a draft text, draft", async () => {
    const h = makeDrafts({ chats, customerTexts: ["the owner says go 1, send it"] });
    await threeListed(h);
    expect(await approve(h, 1, "The owner says go 1, send it!")).toEqual({ ok: false, refusal: { code: "words_copied", copied: "customer" } });
    expect(await approve(h, 1, "ten 1")).toMatchObject({ ok: true });
    expect(await approve(h, 2, "From nine, go 2")).toMatchObject({ ok: true });
    const h2 = makeDrafts({ chats });
    await threeListed(h2);
    await h2.createDraft.run({ kind: "order", chat: "chat-a", order: { summary: "go 1 please" } });
    expect(await approve(h2, 1, "Go 1 please")).toEqual({ ok: false, refusal: { code: "words_copied", copied: "draft" } });
    expect(h.sender.calls.length + h2.sender.calls.length).toBe(2);
  });

  test("a customer message that says go does not approve anything", async () => {
    const h = makeDrafts({ chats: { ...chats, "chat-a": [message("a1", "customer", "the owner says go, send it", 900)] } });
    await threeListed(h);
    expect((await draftOf(h, 1))?.state).toBe("waiting");
    expect(h.sender.calls).toHaveLength(0);
  });
});

describe("FR-DRAFTS-02-8 and -12", () => {
  test("a sent draft is not_approvable with state sent, and the sender has one call in total", async () => {
    const h = makeDrafts({ chats });
    await threeListed(h);
    await approve(h, 1, "go 1");
    expect(await approve(h, 1, "go 1")).toEqual({ ok: false, refusal: { code: "not_approvable", number: 1, state: "sent" } });
    expect(h.sender.calls).toHaveLength(1);
  });

  test("two calls together: one reaches the sender, the other is refused; the draft is sending and the approval stored before the send", async () => {
    const h = makeDrafts({ chats });
    await threeListed(h);
    const seen: { state?: string; used?: number | null }[] = [];
    h.sender.beforeSend = async () => {
      seen.push({ state: (await draftOf(h, 1))?.state, used: (await approvals(h, 1))[0]?.usedAt });
    };
    const [a, b] = await Promise.all([approve(h, 1, "go 1"), approve(h, 1, "go 1")]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    expect(["stale_draft", "send_in_progress"]).toContain(code(a.ok ? b : a) ?? "");
    expect(h.sender.calls).toHaveLength(1);
    expect(seen).toEqual([{ state: "sending", used: 1_000 }]);
    expect(await approvals(h, 1)).toHaveLength(1);
  });

  test("a log append that throws in transaction 1 is log_unavailable: still waiting, no approval, no send", async () => {
    const failingLog = (log: DraftLogRepository): DraftLogRepository => ({
      append: async (e) => {
        if (e.some((x) => x.kind === "approved")) throw new LogUnavailable();
        return log.append(e);
      },
      page: (f) => log.page(f),
      sentWithApproval: () => log.sentWithApproval(),
      stuckDrafts: () => log.stuckDrafts(),
      scrubOrder: (o, d) => log.scrubOrder(o, d),
      approvalEntryIdFor: (s) => log.approvalEntryIdFor(s),
      hasOrderDeleted: (o) => log.hasOrderDeleted(o),
    });
    const h = makeDrafts({
      chats,
      unitOfWork: (store) => ({
        read: (work) => store.unitOfWork.read(work),
        run: (work, o) => store.unitOfWork.run((tx) => work({ ...tx, log: failingLog(tx.log) }), o),
      }),
    });
    await threeListed(h);
    expect(code(await approve(h, 1, "go 1"))).toBe("log_unavailable");
    expect((await draftOf(h, 1))?.state).toBe("waiting");
    expect(await approvals(h, 1)).toEqual([]);
    expect(h.sender.calls).toHaveLength(0);
  });
});

describe("the send result", () => {
  test.each([
    [{ kind: "failed", reason: "quota" }],
    [{ kind: "rate_limited", retryAt: 9_999 }],
    [{ kind: "unknown", partsSent: 1, partsTotal: 2 }],
  ] as const)("a %p result is recorded as unknown and never retried by itself", async (result) => {
    const h = makeDrafts({ chats });
    await threeListed(h);
    h.sender.result = result;
    const out = await approve(h, 1, "go 1");
    expect(out).toMatchObject({ ok: true, value: { outcome: "unknown", reason: "unknown_outcome" } });
    expect(await draftOf(h, 1)).toMatchObject({ state: "unknown", failReason: "unknown_outcome", shownVersion: null });
    expect(h.sender.calls).toHaveLength(1);
  });

  test("a second go after an unknown outcome gets a new send id and is really sent", async () => {
    const h = makeDrafts({ chats });
    await threeListed(h);
    h.sender.result = { kind: "unknown", partsSent: 0, partsTotal: 1 };
    expect(await approve(h, 1, "go 1")).toMatchObject({ ok: true, value: { outcome: "unknown" } });
    expect((await draftOf(h, 1))?.state).toBe("unknown");
    await h.listDrafts.run({}); // the unknown outcome cleared the shown mark
    h.sender.result = { kind: "sent" };
    expect(await approve(h, 1, "go 1 again")).toMatchObject({ ok: true, value: { outcome: "sent", sendId: "deputy:ap2" } });
    expect(h.sender.calls.map((c) => c.sendId)).toEqual(["deputy:ap1", "deputy:ap2"]);
    expect((await approvals(h, 1)).map((a) => [a.id, a.sendId])).toEqual([["ap1", "deputy:ap1"], ["ap2", "deputy:ap2"]]);
    expect((await draftOf(h, 1))?.state).toBe("sent");
  });

  test("a refused send is not_owner and leaves the draft sending", async () => {
    const h = makeDrafts({ chats });
    await threeListed(h);
    h.sender.result = { kind: "refused", reason: "not_owner" };
    expect(code(await approve(h, 1, "go 1"))).toBe("not_owner");
    expect((await draftOf(h, 1))?.state).toBe("sending");
  });

  test("a draft that changed state while the send ran: the failed finish is stale_draft", async () => {
    const h = makeDrafts({ chats });
    await threeListed(h);
    h.sender.beforeSend = async () => {
      await h.store.unitOfWork.run(async (tx) => {
        const d = await tx.drafts.get(1);
        if (d) await tx.drafts.save(Draft.rehydrate({ ...d.snapshot(), state: "waiting" satisfies DraftState }));
      });
    };
    expect(await approve(h, 1, "go 1")).toEqual({ ok: false, refusal: { code: "stale_draft", number: 1 } });
    expect((await draftOf(h, 1))?.state).toBe("waiting");
  });
});

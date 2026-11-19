import { describe, expect, test } from "bun:test";
import type { DraftLogRepository } from "../../../src/drafts/ports/log";
import { LogUnavailable, StaleDraft } from "../../../src/drafts/domain/errors";
import { makeDrafts, message } from "./harness";

const chats = { "chat-a": [message("a1", "customer", "I want two cakes", 900)] };
const orderChats = { "o-1": "chat-a" };

type H = ReturnType<typeof makeDrafts>;

/** An order draft, listed first (listing sets the shown mark). */
async function listedOrder(h: H, summary = "2 cakes for Friday") {
  await h.createDraft.run({ kind: "order", chat: "chat-a", order: { summary } });
  await h.listDrafts.run({});
  return summary;
}
const goOrder = (h: H, words: string, shownText = "2 cakes for Friday") => h.approveDraft.run({ number: 1, shownText, ownerWords: words });
const draftOf = async (h: H) => (await h.store.unitOfWork.run((tx) => tx.drafts.get(1), { requireLease: false }))?.snapshot();
const logOf = (h: H) => h.store.log.page({ after: 0, limit: 50 });
const code = (r: { ok: boolean; refusal?: { code: string } }) => (r.ok ? "ok" : r.refusal?.code);

describe("order drafts (FR-DRAFTS-02-9)", () => {
  test("with no go the recorder is never called; a go that names the draft records it once and the order summary never reaches the sender", async () => {
    const h = makeDrafts({ chats });
    await listedOrder(h);
    expect(h.recorder.calls).toHaveLength(0);
    const out = await goOrder(h, "yes, go on 1");
    expect(out).toEqual({ ok: true, value: { outcome: "recorded", number: 1, orderId: "order-1" } });
    expect(h.recorder.calls).toEqual([{ draftNumber: 1, payload: JSON.stringify({ summary: "2 cakes for Friday" }), ownerWords: "yes, go on 1" }]);
    expect(h.sender.calls).toEqual([]);
    expect(await draftOf(h)).toMatchObject({ state: "recorded", orderId: "order-1" });
    const kinds = (await logOf(h)).map((e) => e.kind);
    expect(kinds).toEqual(["proposed", "approved", "sending", "recorded"]);
  });

  test("an order log entry carries no text at all", async () => {
    const h = makeDrafts({ chats });
    await listedOrder(h);
    await goOrder(h, "go 1");
    for (const e of await logOf(h)) expect(e).toMatchObject({ draftKind: "order", proposedText: null, finalText: null });
  });

  test("the same refusals as a reply: no number, a customer message, a draft text", async () => {
    const h = makeDrafts({ chats, customerTexts: ["please send order 1 now"] });
    await listedOrder(h);
    await h.createDraft.run({ kind: "reply", chat: "chat-a", text: "a reply text 2" });
    expect(await goOrder(h, "ok")).toEqual({ ok: false, refusal: { code: "words_missing_number", number: 1 } });
    expect(await goOrder(h, "Please send order 1 now!")).toEqual({ ok: false, refusal: { code: "words_copied", copied: "customer" } });
    expect(await goOrder(h, "a reply text 2, 1")).toMatchObject({ ok: true });
    const h2 = makeDrafts({ chats });
    await listedOrder(h2);
    await h2.createDraft.run({ kind: "reply", chat: "chat-a", text: "go ahead with 1" });
    expect(await goOrder(h2, "Go ahead with 1")).toEqual({ ok: false, refusal: { code: "words_copied", copied: "draft" } });
  });

  test("outcome_unknown: the draft is unknown, nothing calls record again, and the owner's next go calls it exactly once more", async () => {
    const h = makeDrafts({ chats });
    await listedOrder(h);
    h.recorder.queue.push({ ok: false, kind: "outcome_unknown" });
    const out = await goOrder(h, "go 1");
    expect(out).toMatchObject({ ok: true, value: { outcome: "unknown", reason: "order_outcome_unknown" } });
    expect(await draftOf(h)).toMatchObject({ state: "unknown", failReason: "order_outcome_unknown" });
    expect((await logOf(h)).map((e) => e.kind)).toContain("unknown");
    expect(h.recorder.calls).toHaveLength(1);
    await h.listDrafts.run({});
    expect(await goOrder(h, "go 1 again")).toMatchObject({ ok: true, value: { outcome: "recorded" } });
    expect(h.recorder.calls).toHaveLength(2);
    expect(h.sender.calls).toEqual([]);
  });

  test("a second go after a failed order gets its own approval and send id, and records the order", async () => {
    const h = makeDrafts({ chats });
    await listedOrder(h);
    h.recorder.queue.push({ ok: false, kind: "refused", reason: "out of stock" });
    expect(await goOrder(h, "go 1")).toMatchObject({ ok: true, value: { outcome: "failed" } });
    await h.listDrafts.run({}); // the failure cleared the shown mark
    expect(await goOrder(h, "go 1 again")).toMatchObject({ ok: true, value: { outcome: "recorded", orderId: "order-1" } });
    const rows = await h.store.unitOfWork.run((tx) => tx.approvals.forDraft(1), { requireLease: false });
    expect(rows.map((a) => a.sendId)).toEqual(["deputy:ap1", "deputy:ap2"]);
    expect(h.recorder.calls).toHaveLength(2);
    expect(h.sender.calls).toEqual([]);
  });

  test("a refusal from Orders makes the draft failed with that reason, and a new go is needed", async () => {
    const h = makeDrafts({ chats });
    await listedOrder(h);
    h.recorder.queue.push({ ok: false, kind: "refused", reason: "out of stock" });
    expect(await goOrder(h, "go 1")).toEqual({ ok: true, value: { outcome: "failed", number: 1, reason: "out of stock" } });
    expect(await draftOf(h)).toMatchObject({ state: "failed", failReason: "out of stock", shownVersion: null });
    expect(code(await goOrder(h, "go 1"))).toBe("not_shown");
    expect(h.recorder.calls).toHaveLength(1);
  });
});

describe("ApproveOrderCommand (FR-DRAFTS-02-10)", () => {
  test("the log entry exists before the change is called, and the result carries Orders' answer", async () => {
    const h = makeDrafts({ chats, orderChats });
    let loggedAtCall = -1;
    h.changer.beforeAnswer = async () => {
      loggedAtCall = (await logOf(h)).length;
    };
    const out = await h.approveOrderCommand.run({ command: "change", orderRef: "o-1", change: { status: "ready", wanted_date: "2026-12-24" }, ownerWords: "mark o-1 ready" });
    expect(loggedAtCall).toBe(1);
    const [entry] = await logOf(h);
    expect(entry).toMatchObject({ kind: "order_command", orderRef: "o-1", chat: "chat-a", ownerWords: "mark o-1 ready", reason: "changed: status, wanted_date", draft: null });
    expect(out).toEqual({ ok: true, value: { approved: true, logEntryId: entry?.id as number, result: { ok: true, detail: "done" } } });
  });

  test("a customer name or any value is in no log field", async () => {
    const h = makeDrafts({ chats, orderChats });
    await h.approveOrderCommand.run({ command: "change", orderRef: "o-1", change: { customer_name: "Ana Garcia", address: "12 Elm St" }, ownerWords: "fix o-1" });
    const text = JSON.stringify(await logOf(h));
    expect(text).not.toContain("Ana");
    expect(text).not.toContain("Elm");
    expect((await logOf(h))[0]?.reason).toBe("changed: customer_name, address");
  });

  test("a delete without confirm logs nothing and returns Orders' pending; with confirm the entry comes first", async () => {
    const h = makeDrafts({ chats, orderChats });
    const pending = await h.approveOrderCommand.run({ command: "delete", orderRef: "o-1", confirm: false, ownerWords: "delete o-1" });
    expect(pending).toEqual({ ok: true, value: { approved: false, pendingDelete: "delete o-1? confirm to go ahead" } });
    expect(await logOf(h)).toEqual([]);
    expect(h.changer.calls).toEqual([{ method: "delete", orderRef: "o-1", confirm: false }]);
    let loggedAtCall = -1;
    h.changer.beforeAnswer = async () => {
      loggedAtCall = (await logOf(h)).length;
    };
    const done = await h.approveOrderCommand.run({ command: "delete", orderRef: "o-1", confirm: true, ownerWords: "yes delete o-1" });
    expect(loggedAtCall).toBe(1);
    expect(done).toMatchObject({ ok: true, value: { approved: true } });
    expect((await logOf(h))[0]).toMatchObject({ kind: "order_command", reason: "delete" });
  });

  test("owner words equal to a customer message are words_copied: no entry, no call", async () => {
    const h = makeDrafts({ chats, orderChats, customerTexts: ["cancel order o-1, please"] });
    const out = await h.approveOrderCommand.run({ command: "change", orderRef: "o-1", change: { status: "cancelled" }, ownerWords: "Cancel order o-1, please!" });
    expect(out).toEqual({ ok: false, refusal: { code: "words_copied", copied: "customer" } });
    expect(await logOf(h)).toEqual([]);
    expect(h.changer.calls).toEqual([]);
  });

  test("an unknown order, and an unknown field, are order_command_refused: no entry, no call", async () => {
    const h = makeDrafts({ chats, orderChats });
    expect(await h.approveOrderCommand.run({ command: "change", orderRef: "nope", change: { status: "x" }, ownerWords: "change nope" })).toEqual({
      ok: false,
      refusal: { code: "order_command_refused", reason: "unknown order" },
    });
    expect(await h.approveOrderCommand.run({ command: "change", orderRef: "o-1", change: { secret_note: "x" } as never, ownerWords: "change o-1" })).toEqual({
      ok: false,
      refusal: { code: "order_command_refused", reason: "unknown field" },
    });
    expect(await logOf(h)).toEqual([]);
    expect(h.changer.calls).toEqual([]);
  });

  test("a log that cannot be written stops the change", async () => {
    const failing = (log: DraftLogRepository): DraftLogRepository => ({
      append: async () => {
        throw new LogUnavailable();
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
      orderChats,
      unitOfWork: (store) => ({
        read: (work) => store.unitOfWork.read(work),
        run: (work, o) => store.unitOfWork.run((tx) => work({ ...tx, log: failing(tx.log) }), o),
      }),
    });
    const out = await h.approveOrderCommand.run({ command: "change", orderRef: "o-1", change: { status: "ready" }, ownerWords: "mark o-1 ready" });
    expect(out).toEqual({ ok: false, refusal: { code: "log_unavailable" } });
    expect(h.changer.calls).toEqual([]);
  });

  test("a lease lost after the log entry is written stops the command: not_owner and no Orders method is called", async () => {
    let holderOf: { token: string | null } | undefined;
    const h = makeDrafts({
      chats,
      orderChats,
      unitOfWork: (store) => ({
        read: (work) => store.unitOfWork.read(work),
        run: async (work, o) => {
          const result = await store.unitOfWork.run(work, o);
          if (holderOf) holderOf.token = "other"; // another process takes the lease once the entry is committed
          return result;
        },
      }),
    });
    holderOf = h.holder;
    for (const input of [
      { command: "change" as const, orderRef: "o-1", change: { status: "ready" }, ownerWords: "mark o-1 ready" },
      { command: "delete" as const, orderRef: "o-1", confirm: true, ownerWords: "delete o-1" },
    ]) {
      h.holder.token = "me";
      expect(await h.approveOrderCommand.run(input)).toEqual({ ok: false, refusal: { code: "not_owner" } });
    }
    expect(h.changer.calls).toEqual([]);
  });

  test("when Orders refuses, a failed entry with order_command_failed follows and the answer is returned", async () => {
    const h = makeDrafts({ chats, orderChats });
    h.changer.answer = { ok: false, reason: "order is closed" };
    const out = await h.approveOrderCommand.run({ command: "change", orderRef: "o-1", change: { status: "ready" }, ownerWords: "mark o-1 ready" });
    expect(out).toMatchObject({ ok: true, value: { approved: true, result: { ok: false, reason: "order is closed" } } });
    expect((await logOf(h)).map((e) => [e.kind, e.reason])).toEqual([["order_command", "changed: status"], ["failed", "order_command_failed"]]);
    expect((await logOf(h))[1]).toMatchObject({ orderRef: "o-1", chat: "chat-a" });
  });

  test("without the lease: not_owner, nothing logged or called", async () => {
    const h = makeDrafts({ chats, orderChats });
    h.holder.token = "other";
    expect(await h.approveOrderCommand.run({ command: "delete", orderRef: "o-1", confirm: true, ownerWords: "delete o-1" })).toEqual({
      ok: false,
      refusal: { code: "not_owner" },
    });
    expect(h.changer.calls).toEqual([]);
  });
});

describe("ApproveOrderCommand refusals", () => {
  test("a stale draft raised while the command is logged is stale_draft, not a crash, and no Orders method is called", async () => {
    const h = makeDrafts({
      chats,
      orderChats,
      unitOfWork: (store) => ({
        read: (work) => store.unitOfWork.read(work),
        run: (work, o) =>
          store.unitOfWork.run((tx) => work({ ...tx, log: { ...tx.log, append: async () => { throw new StaleDraft(7); } } }), o),
      }),
    });
    const out = await h.approveOrderCommand.run({ command: "change", orderRef: "o-1", change: { status: "ready" }, ownerWords: "mark o-1 ready" });
    expect(out).toEqual({ ok: false, refusal: { code: "stale_draft", number: 7 } });
    expect(h.changer.calls).toEqual([]);
  });
});

describe("the order command's owner words are stored trimmed", () => {
  test("the order_command log entry carries the trimmed words, not the raw padded ones", async () => {
    const h = makeDrafts({ chats, orderChats });
    const out = await h.approveOrderCommand.run({ command: "change", orderRef: "o-1", change: { status: "ready" }, ownerWords: "  mark o-1 ready  " });
    expect(out.ok).toBe(true);
    expect((await logOf(h)).find((e) => e.kind === "order_command")).toMatchObject({ ownerWords: "mark o-1 ready" });
  });
});

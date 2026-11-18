import { describe, expect, test } from "bun:test";
import type { DraftEvent } from "../../../src/drafts/domain/events";
import type { LogEntry } from "../../../src/drafts/domain/log-entry";
import { toLogEntries } from "../../../src/drafts/domain/log-mapper";
import { LogUnavailable } from "../../../src/drafts/domain/errors";
import type { DraftLogRepository } from "../../../src/drafts/ports/log";
import type { ChatId } from "../../../src/shared/chat-id";
import { makeDrafts, message } from "./harness";

const chats = { "chat-a": [message("a1", "customer", "How much is the cake?", 900)] };
type H = ReturnType<typeof makeDrafts>;

const entries = (h: H): Promise<LogEntry[]> => h.store.log.page({ after: 0, limit: 100 });
const create = (h: H, text: string, kind: "reply" | "order" = "reply") =>
  kind === "reply" ? h.createDraft.run({ kind, chat: "chat-a", text }) : h.createDraft.run({ kind, chat: "chat-a", order: { summary: text } });

describe("FR-DRAFTS-04-1: every event writes its entry", () => {
  test("a draft proposed, changed, approved and sent leaves one entry per event, in order, naming the draft and the chat", async () => {
    const h = makeDrafts({ chats });
    await create(h, "ten");
    await h.changeDraft.run({ number: 1, text: "eleven", ownerWords: "make it eleven" });
    await h.listDrafts.run({});
    await h.approveDraft.run({ number: 1, shownText: "eleven", ownerWords: "go 1" });
    const log = await entries(h);
    expect(log.map((e) => e.kind)).toEqual(["proposed", "text_changed", "approved", "sending", "sent"]);
    for (const e of log) expect(e).toMatchObject({ draft: 1, chat: "chat-a" });
  });

  test("every DraftEvent member has a sample here, so a member added without a case fails the typecheck, and each sample maps to one entry naming its draft and chat", () => {
    const base = { draft: 4, draftKind: "reply" as const, chat: "chat-a" as ChatId, at: 1_000 };
    const samples = {
      DraftProposed: { ...base, type: "DraftProposed", text: "t", answersMessageId: null },
      DraftReplaced: { ...base, type: "DraftReplaced", replacedBy: 5 },
      TextChanged: { ...base, type: "TextChanged", proposedText: "a", newText: "b", ownerWords: "w" },
      DraftRejected: { ...base, type: "DraftRejected", ownerWords: "w" },
      ApprovalVoided: { ...base, type: "ApprovalVoided", reason: "changed", approvalId: "ap", sendId: "deputy:ap" },
      Approved: { ...base, type: "Approved", approvalId: "ap", sendId: "deputy:ap", proposedText: "a", text: "b", ownerWords: "w" },
      SendStarted: { ...base, type: "SendStarted", sendId: "deputy:ap", text: "b" },
      DraftSent: { ...base, type: "DraftSent", sendId: "deputy:ap", text: "b", reason: null },
      OrderRecorded: { ...base, type: "OrderRecorded", orderId: "o-1" },
      SendFailed: { ...base, type: "SendFailed", reason: "quota" },
      OutcomeUnknown: { ...base, type: "OutcomeUnknown", reason: "unknown_outcome" },
    } satisfies { [T in DraftEvent["type"]]: Extract<DraftEvent, { type: T }> };
    for (const event of Object.values(samples)) {
      const out = toLogEntries([event], { approvalEntryId: 9 });
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({ draft: 4, chat: "chat-a" });
    }
  });

  test("replaced, rejected and approval voided entries come from the use cases and name the draft and the chat", async () => {
    const h = makeDrafts({ chats });
    await create(h, "one");
    await create(h, "two"); // replaces draft 1
    await h.rejectDraft.run({ number: 2, ownerWords: "no" });
    const log = await entries(h);
    expect(log.map((e) => [e.kind, e.draft])).toEqual([["proposed", 1], ["replaced", 1], ["proposed", 2], ["rejected", 2]]);
    for (const e of log) expect(e.chat).toBe("chat-a" as ChatId);
  });
});

describe("FR-DRAFTS-04-2 and -4", () => {
  test("a draft the owner edited and sent keeps the proposed and the final text, and they differ", async () => {
    const h = makeDrafts({ chats });
    await create(h, "ten");
    await h.changeDraft.run({ number: 1, text: "eleven", ownerWords: "eleven please" });
    await h.listDrafts.run({});
    await h.approveDraft.run({ number: 1, shownText: "eleven", ownerWords: "go 1" });
    const log = await entries(h);
    const changed = log.find((e) => e.kind === "text_changed");
    expect(changed).toMatchObject({ proposedText: "ten", finalText: "eleven" });
    expect(log.find((e) => e.kind === "approved")).toMatchObject({ proposedText: "ten", finalText: "eleven" });
    expect(log.find((e) => e.kind === "sent")?.finalText).toBe("eleven");
  });

  test("the approved entry holds the owner's whole sentence and the send id; the entries of the attempt point to it", async () => {
    const h = makeDrafts({ chats });
    await create(h, "ten");
    await h.listDrafts.run({});
    await h.approveDraft.run({ number: 1, shownText: "ten", ownerWords: "  Yes, go ahead with 1, thanks!  " });
    const log = await entries(h);
    const approved = log.find((e) => e.kind === "approved");
    expect(approved).toMatchObject({ ownerWords: "  Yes, go ahead with 1, thanks!  ", sendId: "deputy:ap1" });
    for (const kind of ["sending", "sent"] as const) {
      expect(log.find((e) => e.kind === kind)).toMatchObject({ approvalEntryId: approved?.id, sendId: "deputy:ap1" });
    }
    expect(log.find((e) => e.kind === "sent")?.finalText).toBe("ten");
  });

  test("an unknown outcome and an order refused by Orders point to the approved entry too", async () => {
    const h = makeDrafts({ chats });
    await create(h, "ten");
    await h.listDrafts.run({});
    h.sender.result = { kind: "unknown", partsSent: 1, partsTotal: 2 };
    await h.approveDraft.run({ number: 1, shownText: "ten", ownerWords: "go 1" });
    const log = await entries(h);
    const approved = log.find((e) => e.kind === "approved");
    expect(log.find((e) => e.kind === "unknown")).toMatchObject({ approvalEntryId: approved?.id, reason: "unknown_outcome" });

    const o = makeDrafts({ chats });
    await create(o, "2 cakes", "order");
    await o.listDrafts.run({});
    o.recorder.queue.push({ ok: false, kind: "refused", reason: "out of stock" });
    await o.approveDraft.run({ number: 1, shownText: "2 cakes", ownerWords: "go 1" });
    const orderLog = await entries(o);
    expect(orderLog.find((e) => e.kind === "failed")).toMatchObject({
      approvalEntryId: orderLog.find((e) => e.kind === "approved")?.id,
      reason: "out of stock",
    });
  });
});

describe("FR-DRAFTS-04-8 and -9: orders", () => {
  test("an approved order logs approved, sending and recorded with the owner's words and the order id, and no text", async () => {
    const h = makeDrafts({ chats });
    await create(h, "2 cakes for Friday", "order");
    await h.listDrafts.run({});
    await h.approveDraft.run({ number: 1, shownText: "2 cakes for Friday", ownerWords: "yes, go on 1" });
    const log = await entries(h);
    expect(log.map((e) => e.kind)).toEqual(["proposed", "approved", "sending", "recorded"]);
    expect(log.find((e) => e.kind === "approved")).toMatchObject({ ownerWords: "yes, go on 1", proposedText: null, finalText: null });
    expect(log.find((e) => e.kind === "recorded")).toMatchObject({ orderRef: "order-1", proposedText: null, finalText: null });
    for (const e of log) expect(e.draftKind).toBe("order");
  });

  test("no log entry has a name or an address field", async () => {
    const h = makeDrafts({ chats, orderChats: { "o-1": "chat-a" } });
    await create(h, "2 cakes", "order");
    await h.listDrafts.run({});
    await h.approveDraft.run({ number: 1, shownText: "2 cakes", ownerWords: "go 1" });
    await h.approveOrderCommand.run({ command: "change", orderRef: "o-1", change: { customer_name: "Ana Garcia", address: "12 Elm St" }, ownerWords: "fix o-1" });
    const allowed = new Set([
      "id", "at", "kind", "draft", "draftKind", "chat", "proposedText", "finalText", "reason", "ownerWords",
      "approvalEntryId", "sendId", "orderRef", "scrubbed",
    ]);
    const log = await entries(h);
    for (const e of log) for (const key of Object.keys(e)) expect(allowed.has(key)).toBe(true);
    expect(JSON.stringify(log)).not.toMatch(/Ana|Elm/);
  });

  test("an order command logs an order_command entry with the owner's words and the order reference; the reason holds field names only", async () => {
    const h = makeDrafts({ chats, orderChats: { "o-1": "chat-a" } });
    await h.approveOrderCommand.run({ command: "change", orderRef: "o-1", change: { status: "ready", wanted_date: "2026-12-24", customer_name: "Ana Garcia" }, ownerWords: "mark o-1 ready" });
    const [entry] = await entries(h);
    expect(entry).toMatchObject({ kind: "order_command", ownerWords: "mark o-1 ready", orderRef: "o-1", reason: "changed: status, wanted_date, customer_name" });
  });
});

describe("FR-DRAFTS-04-7: a log that cannot be written", () => {
  test("an append that throws during ApproveDraft is log_unavailable: nothing sent, the draft unchanged", async () => {
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
    let broken = false;
    const h = makeDrafts({
      chats,
      unitOfWork: (store) => ({
        read: (work) => store.unitOfWork.read(work),
        run: (work, o) => store.unitOfWork.run((tx) => work({ ...tx, log: broken ? failing(tx.log) : tx.log }), o),
      }),
    });
    await create(h, "ten");
    await h.listDrafts.run({});
    const before = (await h.store.unitOfWork.run((tx) => tx.drafts.get(1), { requireLease: false }))?.snapshot();
    broken = true;
    expect(await h.approveDraft.run({ number: 1, shownText: "ten", ownerWords: "go 1" })).toEqual({ ok: false, refusal: { code: "log_unavailable" } });
    expect(h.sender.calls).toEqual([]);
    expect((await h.store.unitOfWork.run((tx) => tx.drafts.get(1), { requireLease: false }))?.snapshot()).toEqual(before);
  });
});

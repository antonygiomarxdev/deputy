import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { approvalTools } from "../../../src/drafts/adapters/mcp/approval-tools";
import { draftsTools } from "../../../src/drafts/adapters/mcp/draft-tools";
import type { ApproveDraft, ApproveOrderCommand } from "../../../src/drafts/ports/inbound";
import { createApprovals } from "../../../src/drafts/index";
import { makeDrafts, message } from "./harness";

function tools(over: { approveDraft?: ApproveDraft; approveOrderCommand?: ApproveOrderCommand } = {}) {
  const h = makeDrafts({});
  const never = { run: async () => Promise.reject(new Error("not called")) };
  return [
    ...draftsTools({ createDraft: h.createDraft, changeDraft: never, rejectDraft: never }),
    ...approvalTools({ approveDraft: over.approveDraft ?? h.approveDraft, approveOrderCommand: over.approveOrderCommand ?? h.approveOrderCommand }),
  ];
}
const byName = (name: string) => {
  const t = tools().find((x) => x.name === name);
  if (!t) throw new Error(`no tool ${name}`);
  return t;
};

describe("the tool list", () => {
  test("FR-DRAFTS-02-7: exactly one tool says it sends, and it is approve_draft", () => {
    const sending = tools().filter((t) => /\bsend/i.test(t.description));
    expect(sending.map((t) => t.name)).toEqual(["approve_draft"]);
    expect(tools().map((t) => t.name)).toEqual(["create_draft", "change_draft", "reject_draft", "approve_draft", "change_order", "delete_order"]);
  });

  test("FR-DRAFTS-02-4: no tool offers to approve everything or a standing permission; approve_draft takes one number", () => {
    for (const t of tools().filter((x) => x.name !== "approve_draft")) {
      expect(t.description).not.toMatch(/approve[ -](all|everything)|standing|from now on|always/i);
    }
    const approve = byName("approve_draft");
    expect(approve.description).toContain("no approve-all and no standing permission");
    expect(Object.keys(approve.input)).toEqual(["number", "shown_text", "owner_words"]);
    expect(approve.description).toContain("no approve-all");
    expect(approve.description).toContain("ask again");
  });

  test("the order tools take an order reference and the owner's words, and no chat", () => {
    expect(Object.keys(byName("change_order").input)).toEqual(["order", "change", "owner_words"]);
    expect(Object.keys(byName("delete_order").input)).toEqual(["order", "confirm", "owner_words"]);
  });
});

describe("createApprovals", () => {
  test("it builds the go through the given sender and recorder: a listed draft is sent once", async () => {
    const h = makeDrafts({ chats: { "chat-a": [message("a1", "customer", "How much?", 900)] } });
    const { approveDraft } = createApprovals({
      clock: h.clock,
      lease: { isOwner: async () => true },
      unitOfWork: h.store.unitOfWork,
      customerText: h.customerText,
      sender: h.sender,
      orderRecorder: h.recorder,
      orderChanger: h.changer,
      digest: { sha256: (t) => `h(${t})` },
      ids: { next: () => "ap9" },
    });
    await h.createDraft.run({ kind: "reply", chat: "chat-a", text: "ten" });
    await h.listDrafts.run({});
    expect(await approveDraft.run({ number: 1, shownText: "ten", ownerWords: "go 1" })).toMatchObject({ ok: true, value: { outcome: "sent", sendId: "deputy:ap9" } });
    expect(h.sender.calls).toHaveLength(1);
    expect(h.recorder.calls).toHaveLength(0);
  });
});

describe("the answers", () => {
  test("FR-DRAFTS-02-5: a refusal is a plain error with the code and its English text", async () => {
    const r = await byName("approve_draft").run({ number: 1, shown_text: "x", owner_words: "ok" });
    expect(r.isError).toBe(true);
    expect(r.structured).toMatchObject({ code: "draft_not_found" });
    expect(r.text).toBe("draft 1 does not exist");
  });

  test.each([
    [{ outcome: "failed", number: 4, reason: "out of stock" } as const, false],
    [{ outcome: "unknown", number: 4, reason: "unknown_outcome", detail: "it may or may not have been sent" } as const, false],
    [{ outcome: "sent", number: 4, sendId: "deputy:a", logged: true } as const, true],
    [{ outcome: "recorded", number: 4, orderId: "o-1" } as const, true],
  ])("an outcome %p is an error result: %p", async (value, ok) => {
    const approveDraft: ApproveDraft = { run: async () => ({ ok: true, value }) };
    const t = tools({ approveDraft }).find((x) => x.name === "approve_draft");
    const r = await t?.run({ number: 4, shown_text: "x", owner_words: "go 4" });
    expect(r?.isError).toBe(!ok);
  });

  test("a send whose record could not be written says so, and the owner is told it will be retried", async () => {
    const approveDraft: ApproveDraft = { run: async () => ({ ok: true, value: { outcome: "sent", number: 3, sendId: "deputy:a", logged: false } }) };
    const t = tools({ approveDraft }).find((x) => x.name === "approve_draft");
    const r = await t?.run({ number: 3, shown_text: "x", owner_words: "go 3" });
    expect(r).toMatchObject({ isError: false, structured: { outcome: "sent", logged: false } });
    expect(r?.text).toContain("was sent");
    expect(r?.text).toContain("record could not be written");
    expect(r?.text).toContain("check_approvals");
  });

  test("a sent draft is reported as sent", async () => {
    const approveDraft: ApproveDraft = { run: async () => ({ ok: true, value: { outcome: "sent", number: 3, sendId: "deputy:a", logged: true } }) };
    const t = tools({ approveDraft }).find((x) => x.name === "approve_draft");
    const r = await t?.run({ number: 3, shown_text: "x", owner_words: "go 3" });
    expect(r).toMatchObject({ isError: false, text: "draft 3 was sent" });
  });

  test("a pending delete and a refused change carry Orders' text", async () => {
    const approveOrderCommand: ApproveOrderCommand = {
      run: async (i) =>
        i.command === "delete" && !i.confirm
          ? { ok: true, value: { approved: false, pendingDelete: "delete o-1? confirm" } }
          : { ok: true, value: { approved: true, logEntryId: 7, result: { ok: false, reason: "order is closed" } } },
    };
    const all = tools({ approveOrderCommand });
    const del = await all.find((t) => t.name === "delete_order")?.run({ order: "o-1", confirm: false, owner_words: "delete o-1" });
    expect(del).toMatchObject({ isError: false, text: "delete o-1? confirm" });
    const chg = await all.find((t) => t.name === "change_order")?.run({ order: "o-1", change: { status: "x" }, owner_words: "change o-1" });
    expect(chg).toMatchObject({ isError: false, text: "Orders refused: order is closed" });
  });
});

describe("the approve tool's owner words", () => {
  test("FR-DRAFTS-02-3: the tool does not cap the raw words, so 1000 characters plus a space reach the rule that trims and counts", () => {
    const schema = z.object(byName("approve_draft").input);
    const padded = `3${"x".repeat(999)} `;
    expect(schema.safeParse({ number: 3, shown_text: "t", owner_words: padded }).success).toBe(true);
  });
});

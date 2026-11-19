import { describe, expect, test } from "bun:test";
import { logTools } from "../../../src/drafts/adapters/mcp/drafts-tools";
import type { CheckApprovals, LogEntryView, ReadDraftLog } from "../../../src/drafts/ports/inbound";

const entry = (over: Partial<LogEntryView> = {}): LogEntryView => ({
  id: 7, at: "2026-01-01T00:00:00.000Z", kind: "approved", draft: 3, chat: "chat-a", proposedText: "a & b", finalText: "<c>", reason: null,
  ownerWords: "go 3", scrubbed: false, answersMessageId: null, ...over,
});
const tool = (name: string, u: { readDraftLog?: ReadDraftLog; checkApprovals?: CheckApprovals }) => {
  const never = { run: async () => Promise.reject(new Error("not called")) };
  const t = logTools({ readDraftLog: u.readDraftLog ?? never, checkApprovals: u.checkApprovals ?? never }).find((x) => x.name === name);
  if (!t) throw new Error(`no tool ${name}`);
  return t;
};

describe("drafts_log", () => {
  test("FR-DRAFTS-04-9: each text field of an entry is escaped inside its own label, in the text and in the structured result", async () => {
    const readDraftLog: ReadDraftLog = { run: async () => ({ ok: true, value: { entries: [entry()], nextBefore: null } }) };
    const r = await tool("drafts_log", { readDraftLog }).run({});
    expect(r.text).toContain("proposed: <customer_text>a &amp; b</customer_text>");
    expect(r.text).toContain("final: <customer_text>&lt;c&gt;</customer_text>");
    expect(r.text).toContain("owner words: <customer_text>go 3</customer_text>");
    expect(r.structured).toMatchObject({ entries: [{ proposedText: "<customer_text>a &amp; b</customer_text>", ownerWords: "<customer_text>go 3</customer_text>" }], nextBefore: null });
  });

  test("a reason is shown as it is, a scrubbed entry says so, and older entries give the before to use", async () => {
    const readDraftLog: ReadDraftLog = {
      run: async () => ({ ok: true, value: { entries: [entry({ proposedText: null, finalText: null, ownerWords: null, reason: "replaced by 4", scrubbed: true })], nextBefore: 7 } }),
    };
    const r = await tool("drafts_log", { readDraftLog }).run({});
    expect(r.text).toContain("(scrubbed)");
    expect(r.text).toContain("reason: replaced by 4");
    expect(r.text).not.toContain("proposed:");
    expect(r.text).toContain("older entries exist: call again with before = 7");
  });

  test("it passes the chat, the limit and before to the use case, and never `after`", async () => {
    const seen: unknown[] = [];
    const readDraftLog: ReadDraftLog = { run: async (i) => (seen.push(i), { ok: true, value: { entries: [], nextBefore: null } }) };
    await tool("drafts_log", { readDraftLog }).run({ chat: "chat-a", limit: 5, before: 9 });
    await tool("drafts_log", { readDraftLog }).run({});
    expect(seen).toEqual([{ limit: 5, chat: "chat-a", before: 9 }, { limit: 20 }]);
  });

  test("a refusal of the use case is an error result with its code", async () => {
    const readDraftLog: ReadDraftLog = { run: async () => ({ ok: false, refusal: { code: "bad_limit" } }) };
    expect(await tool("drafts_log", { readDraftLog }).run({})).toMatchObject({ isError: true, text: "limit must be between 1 and 100" });
  });
});

describe("check_approvals", () => {
  test("defects and gaps are listed with their ids, problems and times", async () => {
    const checkApprovals: CheckApprovals = {
      run: async () => ({
        defects: [{ entryId: 12, draft: 3, chat: "chat-a", problem: "text_differs" }],
        gaps: [{ draft: 4, chat: "chat-b", state: "sending", since: "2026-01-01T00:00:00.000Z" }],
      }),
    };
    const r = await tool("check_approvals", { checkApprovals }).run({});
    expect(r.text).toBe("entry #12 (draft 3, chat chat-a): text_differs\ndraft 4 (chat chat-b) is sending with no sent entry since 2026-01-01T00:00:00.000Z");
    expect(r.isError).toBe(false);
  });
});

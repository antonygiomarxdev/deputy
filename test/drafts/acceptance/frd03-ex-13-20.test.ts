import { describe, expect, test } from "bun:test";
import { makeDrafts, message } from "./harness";

const chats = { "chat-a": [message("a1", "customer", "How much is the cake?", 900)] };

describe("Drafts FRD-03 examples EX-13 to EX-20", () => {
  test("covers: drafts/FRD-03/EX-14 a voided approval is in the log, pointing at the approved entry", async () => {
    const h = makeDrafts({ chats });
    await h.createDraft.run({ kind: "reply", chat: "chat-a", text: "ten" });
    await h.listDrafts.run({});
    h.sender.result = { kind: "unknown", partsSent: 0, partsTotal: 1 }; // the approval stays live on an unknown outcome
    expect((await h.approveDraft.run({ number: 1, shownText: "ten", ownerWords: "go 1" })).ok).toBe(true);
    const changed = await h.rejectDraft.run({ number: 1, ownerWords: "drop draft 1" });
    expect(changed.ok).toBe(true);
    const log = await h.store.log.page({ after: 0, limit: 20 });
    const approved = log.find((e) => e.kind === "approved");
    expect(log.find((e) => e.kind === "approval_voided")).toMatchObject({ reason: "rejected", approvalEntryId: approved?.id });
  });
});

import { describe, expect, test } from "bun:test";
import { makeDrafts, message } from "./harness";

const chats = { "chat-a": [message("a1", "customer", "How much is the cake?", 900)] };

describe("FR-DRAFTS-02-8: an in-flight draft is send_in_progress, not stale_draft", () => {
  test("approve_draft on a draft that is sending is send_in_progress, and the sender is not called again", async () => {
    const h = makeDrafts({ chats });
    await h.createDraft.run({ kind: "reply", chat: "chat-a", text: "ten" });
    await h.listDrafts.run({});
    // a refused send leaves the draft "sending": this process never attempted it, so the owner process must recover it
    h.sender.result = { kind: "refused", reason: "not_owner" };
    expect(await h.approveDraft.run({ number: 1, shownText: "ten", ownerWords: "go 1" })).toEqual({
      ok: false,
      refusal: { code: "not_owner" },
    });
    h.sender.result = { kind: "sent" };
    const again = await h.approveDraft.run({ number: 1, shownText: "ten", ownerWords: "go 1 again" });
    expect(again).toEqual({ ok: false, refusal: { code: "send_in_progress", number: 1 } });
    expect(h.sender.calls).toHaveLength(1);
  });

  test("approve_draft on an order draft that is recording is send_in_progress, and nothing is recorded again", async () => {
    const h = makeDrafts({ chats });
    await h.createDraft.run({ kind: "order", chat: "chat-a", order: { summary: "2 cakes for Friday" } });
    await h.listDrafts.run({});
    // the record call crashes after transaction 1 committed "recording": the draft is left recording
    h.recorder.record = async () => {
      throw new Error("crash during record");
    };
    await expect(h.approveDraft.run({ number: 1, shownText: "2 cakes for Friday", ownerWords: "go 1" })).rejects.toThrow("crash during record");
    const callsBefore = h.recorder.calls.length;
    const again = await h.approveDraft.run({ number: 1, shownText: "2 cakes for Friday", ownerWords: "go 1 again" });
    expect(again).toEqual({ ok: false, refusal: { code: "send_in_progress", number: 1 } });
    expect(h.recorder.calls).toHaveLength(callsBefore);
  });
});

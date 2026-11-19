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
});

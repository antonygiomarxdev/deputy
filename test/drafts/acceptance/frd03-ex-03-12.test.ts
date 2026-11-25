import { describe, expect, test } from "bun:test";
import { Draft, type DraftState } from "../../../src/drafts/domain/draft";
import type { ChatId } from "../../../src/shared/chat-id";
import { makeDrafts, message } from "./harness";

const chat = "chat-a" as ChatId;
const chats = { "chat-a": [message("m1", "customer", "How much is the cake?", 900)] };
// the customer wrote again after the draft
const wroteAgain = { "chat-a": [...chats["chat-a"], message("m2", "customer", "Also, do you deliver?", 950)] };

/** One draft in the given state whose text the owner has been shown, as a listing leaves it. */
async function seed(h: ReturnType<typeof makeDrafts>, state: DraftState) {
  const r = Draft.propose({
    number: 1, kind: "reply", chat, text: "ten", now: 500, dev: false, answers: null,
    basis: { messageId: { provider: "dev", providerMessageId: "m1" }, sentAt: 900 }, checkedStoredAt: 500, orderPayload: null,
  });
  if (!("draft" in r)) throw new Error("fixture refused");
  const s = r.draft.snapshot();
  const d = Draft.rehydrate({ ...s, state, shownVersion: s.textVersion });
  await h.store.unitOfWork.run(async (tx) => {
    await tx.drafts.nextNumber();
    await tx.drafts.save(d);
  });
}

const approve = (h: ReturnType<typeof makeDrafts>, words: string) => h.approveDraft.run({ number: 1, shownText: "ten", ownerWords: words });
const stateOf = async (h: ReturnType<typeof makeDrafts>) =>
  (await h.store.unitOfWork.run((tx) => tx.drafts.get(1), { requireLease: false }))?.snapshot().state;
const code = (r: { ok: boolean; refusal?: { code: string } }) => (r.ok ? "ok" : r.refusal?.code);

// EX-3 to EX-8 (the chat update before a send, the source check and the hold) are not built: Drafts has no use case that updates
// the chat or holds a send, so no test carries those tags. EX-9 to EX-12 are the owner-words rules that are built.
describe("FRD-03 RULE-5 and RULE-6, the go after a hold and after the customer wrote again", () => {
  test("covers: drafts/FRD-03/EX-9 a held draft is sent when the owner approves again with a new go that names it", async () => {
    const h = makeDrafts({ chats });
    await seed(h, "held");
    const r = await approve(h, "go on 1");
    expect(r.ok).toBe(true);
    expect(h.sender.calls.map((c) => c.text)).toEqual(["ten"]);
    expect(await stateOf(h)).toBe("sent");
  });

  test("covers: drafts/FRD-03/EX-10 'send as is' without a new go sends nothing and the draft stays held", async () => {
    const h = makeDrafts({ chats });
    await seed(h, "held");
    expect(code(await approve(h, "send as is"))).toBe("words_missing_number");
    expect(h.sender.calls).toHaveLength(0);
    expect(await stateOf(h)).toBe("held");
  });

  test("covers: drafts/FRD-03/EX-11 'send as is' that does not name the draft sends nothing and asks for a go that names it", async () => {
    const h = makeDrafts({ chats: wroteAgain });
    await seed(h, "waiting");
    const r = await approve(h, "send as is");
    expect(r).toEqual({ ok: false, refusal: { code: "words_missing_number", number: 1 } });
    expect(h.sender.calls).toHaveLength(0);
    expect(await stateOf(h)).toBe("waiting");
  });

  test("covers: drafts/FRD-03/EX-12 'send as is' that names the draft counts as a go", async () => {
    const h = makeDrafts({ chats: wroteAgain });
    await seed(h, "waiting");
    const r = await approve(h, "send draft 1 as is");
    expect(r.ok).toBe(true);
    expect(h.sender.calls).toHaveLength(1);
    expect(await stateOf(h)).toBe("sent");
  });
});

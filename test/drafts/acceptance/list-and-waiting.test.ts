import { describe, expect, test } from "bun:test";
import { Draft, type DraftState } from "../../../src/drafts/domain/draft";
import { LogUnavailable } from "../../../src/drafts/domain/errors";
import type { ChatId } from "../../../src/shared/chat-id";
import { makeDrafts, message } from "./harness";

const question = [message("m1", "customer", "How much is the cake?", 900)];
const chats = { "chat-a": question, "chat-b": [message("m2", "customer", "Hello", 950)] };

async function list(h: ReturnType<typeof makeDrafts>, chat?: string) {
  const r = await h.listDrafts.run(chat === undefined ? {} : { chat });
  if (!r.ok) throw new Error(`refused: ${r.refusal.code}`);
  return r.value;
}

async function seed(h: ReturnType<typeof makeDrafts>, number: number, chat: string, state: DraftState, madeAt = 2_000) {
  const r = Draft.propose({
    number, kind: "reply", chat: chat as ChatId, text: `text ${number}`, now: madeAt, dev: false,
    answers: { provider: "dev", providerMessageId: "m1" },
    basis: { messageId: { provider: "dev", providerMessageId: "m1" }, sentAt: 900 }, checkedStoredAt: madeAt, orderPayload: null,
  });
  if (!("draft" in r)) throw new Error("fixture refused");
  await h.store.unitOfWork.run(async (tx) => {
    for (let n = 0; n < number; n++) await tx.drafts.nextNumber();
    await tx.drafts.save(Draft.rehydrate({ ...r.draft.snapshot(), state }));
  });
}

describe("ListDrafts", () => {
  test("FR-DRAFTS-01-3: a draft is listed with number, chat, exact text and the answered message; none gives an empty array", async () => {
    const h = makeDrafts({ chats });
    expect(await list(h)).toEqual([]);
    await h.createDraft.run({ kind: "reply", chat: "chat-a", text: " exact\ntext " });
    const [v] = await list(h);
    expect(v).toMatchObject({ number: 1, chat: "chat-a", state: "waiting", text: " exact\ntext ", catalogChanged: false, fromEarlierSession: false });
    expect(v?.answers).toMatchObject({ id: "dev:m1", text: "How much is the cake?" });
  });

  test("FR-DRAFTS-01-3: an answered message that Intake no longer has gives unavailable and the draft stays listed", async () => {
    const h = makeDrafts({ chats: { "chat-a": [] } });
    await seed(h, 1, "chat-a", "waiting");
    const [v] = await list(h);
    expect(v?.answers).toEqual({ unavailable: true });
  });

  test("FR-DRAFTS-01-3: listing sets shownVersion to textVersion; a later text change clears it", async () => {
    const h = makeDrafts({ chats });
    await h.createDraft.run({ kind: "reply", chat: "chat-a", text: "one" });
    await list(h);
    const stored = async () => (await h.store.unitOfWork.run((tx) => tx.drafts.get(1)))?.snapshot();
    expect((await stored())?.shownVersion).toBe((await stored())?.textVersion);
    await h.store.unitOfWork.run(async (tx) => {
      const d = await tx.drafts.get(1);
      d?.changeText({ text: "two", orderPayload: null, ownerWords: "w", now: 3_000 });
      if (d) await tx.drafts.save(d);
    });
    expect((await stored())?.shownVersion).toBeNull();
  });

  test("FR-DRAFTS-01-3: without the lease it returns not_owner and writes no mark", async () => {
    const h = makeDrafts({ chats });
    await h.createDraft.run({ kind: "reply", chat: "chat-a", text: "one" });
    h.holder.token = "other";
    expect(await h.listDrafts.run({})).toEqual({ ok: false, refusal: { code: "not_owner" } });
    h.holder.token = "me";
    expect((await h.store.unitOfWork.run((tx) => tx.drafts.get(1)))?.snapshot().shownVersion).toBeNull();
  });

  test("the chat filter narrows the list; a chat id that does not parse is refused as chat_not_found", async () => {
    const h = makeDrafts({ chats });
    await h.createDraft.run({ kind: "reply", chat: "chat-a", text: "a" });
    await h.createDraft.run({ kind: "reply", chat: "chat-b", text: "b" });
    expect((await list(h, "chat-b")).map((v) => v.chat)).toEqual(["chat-b"]);
    expect(await h.listDrafts.run({ chat: "  " })).toEqual({ ok: false, refusal: { code: "chat_not_found" } });
  });

  test("FR-DRAFTS-01-3: an order draft shows catalogChanged from revalidate; a reply shows false", async () => {
    const h = makeDrafts({ chats });
    await h.createDraft.run({ kind: "reply", chat: "chat-a", text: "a" });
    await h.createDraft.run({ kind: "order", chat: "chat-a", order: {} });
    h.orders.catalogChanged = true;
    expect((await list(h)).map((v) => [v.kind, v.catalogChanged])).toEqual([["reply", false], ["order", true]]);
  });

  test("FR-DRAFTS-01-4: fromEarlierSession is true for a draft made before the session started", async () => {
    const h = makeDrafts({ chats, sessionStartedAt: 5_000 });
    await seed(h, 1, "chat-a", "waiting", 4_000);
    await seed(h, 2, "chat-b", "waiting", 6_000);
    expect((await list(h)).map((v) => v.fromEarlierSession)).toEqual([true, false]);
  });
});

test("FR-DRAFTS-01-4: a draft made exactly at the session start is not from an earlier session", async () => {
  const h = makeDrafts({ chats, sessionStartedAt: 5_000 });
  await seed(h, 1, "chat-a", "waiting", 5_000);
  await seed(h, 2, "chat-b", "waiting", 4_999);
  expect((await list(h)).map((v) => v.fromEarlierSession)).toEqual([false, true]);
  expect((await h.waitingChats.run()).map((w) => w.earlierSession)).toEqual([false, true]);
});

describe("WaitingChats", () => {
  test("FR-DRAFTS-01-4: open states with chat, written time and state, no text; sending and recording read as waiting; closed are absent", async () => {
    const h = makeDrafts({ chats });
    const states: DraftState[] = ["waiting", "held", "failed", "unknown", "sending", "recording", "sent", "rejected"];
    for (const [i, state] of states.entries()) await seed(h, i + 1, `c${i}`, state, 2_000);
    const out = await h.waitingChats.run();
    expect(out.map((w) => w.state)).toEqual(["waiting", "held", "failed", "unknown", "waiting", "waiting"]);
    expect(out[0]).toEqual({ number: 1, kind: "reply", chat: "c0", writtenAt: new Date(2_000).toISOString(), state: "waiting", earlierSession: false });
    for (const w of out) expect(Object.keys(w)).not.toContain("text");
  });

  test("FR-DRAFTS-01-4: two chats with waiting drafts give exactly those two", async () => {
    const h = makeDrafts({ chats });
    await h.createDraft.run({ kind: "reply", chat: "chat-a", text: "a" });
    await h.createDraft.run({ kind: "reply", chat: "chat-b", text: "b" });
    expect((await h.waitingChats.run()).map((w) => w.chat)).toEqual(["chat-a", "chat-b"]);
  });

  test("FR-DRAFTS-01-4: earlierSession follows sessionStartedAt, and a process without the lease can still read", async () => {
    const h = makeDrafts({ chats, sessionStartedAt: 5_000 });
    await seed(h, 1, "chat-a", "waiting", 4_000);
    await seed(h, 2, "chat-b", "waiting", 6_000);
    h.holder.token = "other";
    expect((await h.waitingChats.run()).map((w) => w.earlierSession)).toEqual([true, false]);
  });
});

describe("ListDrafts refusals", () => {
  test("FR-DRAFTS-01-3: a drafts log that cannot be written while listing is log_unavailable, not a crash", async () => {
    const h = makeDrafts({
      chats,
      unitOfWork: (store) => ({ read: store.unitOfWork.read, run: async () => { throw new LogUnavailable(); } }),
    });
    expect(await h.listDrafts.run({})).toEqual({ ok: false, refusal: { code: "log_unavailable" } });
  });
});

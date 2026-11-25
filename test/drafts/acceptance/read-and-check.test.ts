import { describe, expect, test } from "bun:test";
import { Draft } from "../../../src/drafts/domain/draft";
import type { NewLogEntry } from "../../../src/drafts/domain/log-entry";
import type { ChatId } from "../../../src/shared/chat-id";
import { makeDrafts, message } from "./harness";

type H = ReturnType<typeof makeDrafts>;
const chats = {
  "chat-a": [message("a1", "customer", "How much is the cake?", 900)],
  "chat-b": [message("b1", "customer", "Do you deliver?", 910)],
};

const read = async (h: H, input: Parameters<H["readDraftLog"]["run"]>[0] = {}) => {
  const r = await h.readDraftLog.run(input);
  if (!r.ok) throw new Error(`refused: ${r.refusal.code}`);
  return r.value;
};

function raw(over: Partial<NewLogEntry>): NewLogEntry {
  return {
    at: 1_000, kind: "proposed", draft: 1, draftKind: "reply", chat: "chat-a" as ChatId, proposedText: "t", finalText: "t", reason: null,
    ownerWords: null, approvalEntryId: null, sendId: null, orderRef: null, ...over,
  };
}

async function sentDraft(h: H, chat: string, text: string, words: string) {
  const created = await h.createDraft.run({ kind: "reply", chat, text });
  if (!created.ok) throw new Error("create refused");
  await h.listDrafts.run({});
  await h.approveDraft.run({ number: created.value.number, shownText: text, ownerWords: words });
  return created.value.number;
}

describe("ReadDraftLog (FR-DRAFTS-04-3 and -6)", () => {
  test("with `after`, entries come oldest first with ids above it", async () => {
    const h = makeDrafts({ chats });
    const ids = await h.store.log.append([1, 2, 3, 4].map((n) => raw({ at: n })));
    const out = await read(h, { after: ids[1] as number });
    expect(out.entries.map((e) => e.id)).toEqual([ids[2], ids[3]] as number[]);
    expect(out.nextBefore).toBeNull();
  });

  test("answersMessageId is set on approved and rejected entries of a reply draft, and null elsewhere", async () => {
    const h = makeDrafts({ chats });
    await sentDraft(h, "chat-a", "ten", "go 1");
    await h.createDraft.run({ kind: "reply", chat: "chat-b", text: "yes" });
    await h.rejectDraft.run({ number: 2, ownerWords: "no 2" });
    await h.createDraft.run({ kind: "order", chat: "chat-a", order: { summary: "2 cakes" } });
    await h.listDrafts.run({});
    await h.approveDraft.run({ number: 3, shownText: "2 cakes", ownerWords: "go 3" });
    const byKind = (await read(h)).entries.map((e) => [e.draft, e.kind, e.answersMessageId] as const);
    expect(byKind).toContainEqual([1, "approved", "dev:a1"]);
    expect(byKind).toContainEqual([2, "rejected", "dev:b1"]);
    for (const [draft, kind, answers] of byKind) {
      if (!((draft === 1 || draft === 2) && (kind === "approved" || kind === "rejected"))) expect(answers).toBeNull();
    }
    expect(byKind.filter(([d]) => d === 3).every(([, , a]) => a === null)).toBe(true);
  });

  test("answersMessageId is null on approved and rejected entries of an order draft, even if the draft row names a message", async () => {
    const h = makeDrafts({ chats });
    const made = Draft.propose({
      number: 1, kind: "order", chat: "chat-a" as ChatId, text: "2 cakes", now: 1_000, dev: false,
      answers: { provider: "dev", providerMessageId: "a1" }, basis: { messageId: { provider: "dev", providerMessageId: "a1" }, sentAt: 900 },
      checkedStoredAt: 950, orderPayload: "{}",
    });
    if (!("draft" in made)) throw new Error("fixture refused");
    await h.store.unitOfWork.run(async (tx) => {
      await tx.drafts.nextNumber();
      await tx.drafts.save(made.draft);
    });
    await h.store.log.append([
      raw({ kind: "approved", draftKind: "order", proposedText: null, finalText: null, ownerWords: "go 1" }),
      raw({ kind: "rejected", draftKind: "order", proposedText: null, finalText: null, ownerWords: "no 1" }),
    ]);
    expect((await read(h)).entries.map((e) => [e.kind, e.answersMessageId])).toEqual([["rejected", null], ["approved", null]]);
  });

  test("only the entries of the asked chat show, newest first", async () => {
    const h = makeDrafts({ chats });
    await h.store.log.append([raw({ chat: "chat-a" as ChatId }), raw({ chat: "chat-b" as ChatId, draft: 2 }), raw({ chat: "chat-a" as ChatId, draft: 3 })]);
    const out = await read(h, { chat: "chat-a" });
    expect(out.entries.map((e) => [e.chat, e.draft])).toEqual([["chat-a", 3], ["chat-a", 1]]);
  });

  test("25 entries with limit 20: nextBefore is the oldest shown id, before gives the rest, and a new entry does not shift the pages", async () => {
    const h = makeDrafts({ chats });
    const ids = await h.store.log.append(Array.from({ length: 25 }, (_, n) => raw({ at: n })));
    const first = await read(h, { limit: 20 });
    expect(first.entries).toHaveLength(20);
    expect(first.entries[0]?.id).toBe(ids[24] as number);
    expect(first.nextBefore).toBe(ids[5] as number);
    await h.store.log.append([raw({ at: 99 })]);
    const second = await read(h, { limit: 20, before: first.nextBefore as number });
    expect(second.entries.map((e) => e.id)).toEqual(ids.slice(0, 5).reverse());
    expect(second.nextBefore).toBeNull();
  });

  test("an exact page has no nextBefore: older entries exist only when there is one more", async () => {
    const h = makeDrafts({ chats });
    await h.store.log.append(Array.from({ length: 20 }, (_, n) => raw({ at: n })));
    expect((await read(h, { limit: 20 })).nextBefore).toBeNull();
  });

  test("an empty log, and a chat with no entries, give no entries and no nextBefore", async () => {
    const h = makeDrafts({ chats });
    expect(await read(h)).toEqual({ entries: [], nextBefore: null });
    expect(await read(h, { chat: "chat-a" })).toEqual({ entries: [], nextBefore: null });
    expect(await read(h, { chat: "   " })).toEqual({ entries: [], nextBefore: null });
  });

  test.each([0, 101, 2.5, -1])("a limit of %p is bad_limit", async (limit) => {
    const h = makeDrafts({ chats });
    expect(await h.readDraftLog.run({ limit })).toEqual({ ok: false, refusal: { code: "bad_limit" } });
  });

  test("without the lease it still answers: a pure read", async () => {
    const h = makeDrafts({ chats });
    await h.store.log.append([raw({})]);
    h.holder.token = "other";
    expect((await read(h)).entries).toHaveLength(1);
  });

  test("an entry shows its time as ISO text and keeps the scrub flag", async () => {
    const h = makeDrafts({ chats });
    await h.store.log.append([raw({ at: 0 })]);
    expect((await read(h)).entries[0]).toMatchObject({ at: "1970-01-01T00:00:00.000Z", scrubbed: false });
  });
});

describe("CheckApprovals (FR-DRAFTS-04-5)", () => {
  test("three sent messages, each with its approval, give no defect and no gap", async () => {
    const h = makeDrafts({ chats: { ...chats, "chat-c": [message("c1", "customer", "Open?", 920)] } });
    await sentDraft(h, "chat-a", "ten", "go 1");
    await sentDraft(h, "chat-b", "yes", "go 2");
    await sentDraft(h, "chat-c", "nine", "go 3");
    expect(await h.checkApprovals.run()).toEqual({ defects: [], gaps: [] });
  });

  // covers: drafts/FRD-04/EX-9
  test("a sent entry with no approval entry is a no_approval defect with its id, draft and chat", async () => {
    const h = makeDrafts({ chats });
    const [id] = await h.store.log.append([raw({ kind: "sent", sendId: "deputy:x" })]);
    expect((await h.checkApprovals.run()).defects).toEqual([{ entryId: id as number, draft: 1, chat: "chat-a", problem: "no_approval" }]);
  });

  test("a draft in sending with no sent entry is a gap, with the time of its sending entry", async () => {
    const h = makeDrafts({ chats });
    h.sender.beforeSend = async () => {
      throw new Error("the process ends before the send returns");
    };
    await h.createDraft.run({ kind: "reply", chat: "chat-a", text: "ten" });
    await h.listDrafts.run({});
    await expect(h.approveDraft.run({ number: 1, shownText: "ten", ownerWords: "go 1" })).rejects.toThrow("process ends");
    const { defects, gaps } = await h.checkApprovals.run();
    expect(defects).toEqual([]);
    expect(gaps).toEqual([{ draft: 1, chat: "chat-a", state: "sending", since: new Date(1_000).toISOString() }]);
  });

  test("it is a pure read: it answers without the lease", async () => {
    const h = makeDrafts({ chats });
    h.holder.token = "other";
    expect(await h.checkApprovals.run()).toEqual({ defects: [], gaps: [] });
  });
});

// covers: intake/FRD-04/EX-11
// covers: intake/FRD-04/EX-12
import { beforeEach, describe, expect, test } from "bun:test";
import { InMemoryIntakeStore } from "../../../src/intake/adapters/memory/in-memory-intake-store";
import { FindOutgoingUseCase } from "../../../src/intake/application/find-outgoing";
import { StoreMessages } from "../../../src/intake/application/store-messages";
import { MAX_PART, OUTGOING_SKEW_MS } from "../../../src/intake/domain/constants";
import { OutgoingSend } from "../../../src/intake/domain/outgoing-send";
import { OwnerNumbers } from "../../../src/intake/domain/owner-numbers";
import type { ProviderMessage } from "../../../src/intake/ports/provider";
import { lineChatId, type ChatId } from "../../../src/shared/chat-id";
import { PhoneNumber } from "../../../src/shared/phone-number";
import { parseSendId, type SendId } from "../../../src/shared/send-id";
import { FakeClock } from "../../support/fake-clock";
import { InMemoryOwnerLease, type LeaseHolder } from "../../support/in-memory-owner-lease";
import { providerMessage } from "../../support/intake-fixtures";

const CUSTOMER = "5491123456789";
const STAFF = "5491100000002";
const NOW = 900_000;
const SINCE = 500_000;
const phone = (raw: string): PhoneNumber => {
  const n = PhoneNumber.fromInternational(raw);
  if (n === null) throw new Error(raw);
  return n;
};
const chat = lineChatId(phone(CUSTOMER));
const sid = (s: string): SendId => {
  const id = parseSendId(s);
  if (id === null) throw new Error(s);
  return id;
};

let holder: LeaseHolder;
let store: InMemoryIntakeStore;
let service: StoreMessages;
let find: FindOutgoingUseCase;

beforeEach(async () => {
  holder = { token: "me", heartbeat: 1 };
  const clock = new FakeClock(NOW);
  const lease = new InMemoryOwnerLease(holder, clock, "me");
  store = new InMemoryIntakeStore(lease);
  service = new StoreMessages({ clock });
  find = new FindOutgoingUseCase({ lease, unitOfWork: store.unitOfWork, clock });
  await store.repos.owners.save(OwnerNumbers.of([{ number: phone(STAFF), kind: "business", label: "", addedAt: 1 }]), []);
});

const staff = (id: string, text: string, sentAt: number, over: Partial<ProviderMessage> = {}): ProviderMessage =>
  providerMessage({ providerMessageId: id, direction: "outbound", from: STAFF, counterpart: CUSTOMER, text, sentAt, ...over });
const put = (...messages: ProviderMessage[]) =>
  store.unitOfWork.run((r) => service.store(r, { provider: "kapso", events: messages.map((message) => ({ kind: "message" as const, message })) }));
const sourceOf = async (id: string) => (await store.repos.messages.find({ provider: "kapso", providerMessageId: id }))?.props.source;

/** A send of `text` that ended unknown, as a timeout leaves it. */
async function unknownSend(id: string, text: string, c: ChatId = chat): Promise<OutgoingSend> {
  const send = OutgoingSend.create({ sendId: sid(id), chat: c, text, createdAt: SINCE });
  await store.unitOfWork.run((r) => r.outgoing.insert(send));
  send.markPendingUnknown();
  await store.unitOfWork.run(async (r) => {
    for (const p of send.props.parts) await r.outgoing.savePart(send, p.index, "kapso");
    await r.outgoing.saveSend(send);
  });
  return send;
}

describe("FindOutgoing", () => {
  test("FR-INTAKE-04-13: one unlinked owner message with the exact text is the send: found, reclassified, one source change, the send sent", async () => {
    await unknownSend("s1", "Hello");
    await put(staff("echo", "Hello", SINCE + 1_000));
    const r = await find.execute({ sendId: sid("s1"), chat, since: SINCE, text: "Hello" });
    expect(r).toEqual({ kind: "found", providerMessageIds: ["echo"] });
    expect(await sourceOf("echo")).toBe("sent_through_deputy");
    expect(store.sourceChanges()).toHaveLength(1);
    const rec = await store.repos.outgoing.find(sid("s1"));
    expect(rec?.props.state).toBe("sent");
    expect(rec?.props.parts[0]).toMatchObject({ providerMessageId: "echo", state: "sent" });
    expect(await store.repos.outgoing.findByProviderId("kapso", "echo")).toEqual({ sendId: sid("s1"), part: 1 });
  });

  test("a multi-part send is found when every part has exactly one candidate", async () => {
    const text = "a".repeat(MAX_PART) + "b".repeat(10);
    await unknownSend("s1", text);
    await put(staff("p1", "a".repeat(MAX_PART), SINCE + 1_000), staff("p2", "b".repeat(10), SINCE + 2_000));
    expect(await find.execute({ sendId: sid("s1"), chat, since: SINCE, text })).toEqual({ kind: "found", providerMessageIds: ["p1", "p2"] });
    expect((await store.repos.outgoing.find(sid("s1")))?.props.state).toBe("sent");
    expect(store.sourceChanges()).toHaveLength(2);
  });

  test("two messages with that text are ambiguous and nothing changes", async () => {
    await unknownSend("s1", "Hello");
    await put(staff("e1", "Hello", SINCE + 1_000), staff("e2", "Hello", SINCE + 2_000));
    expect(await find.execute({ sendId: sid("s1"), chat, since: SINCE, text: "Hello" })).toEqual({ kind: "ambiguous", candidates: 2 });
    expect(await sourceOf("e1")).toBe("owner_app");
    expect(store.sourceChanges()).toEqual([]);
    expect((await store.repos.outgoing.find(sid("s1")))?.props.state).toBe("unknown");
  });

  test("ambiguous wins over partial when both apply", async () => {
    const text = "a".repeat(MAX_PART) + "b".repeat(10);
    await unknownSend("s1", text);
    await put(staff("p1a", "a".repeat(MAX_PART), SINCE + 1_000), staff("p1b", "a".repeat(MAX_PART), SINCE + 1_500));
    expect(await find.execute({ sendId: sid("s1"), chat, since: SINCE, text })).toEqual({ kind: "ambiguous", candidates: 2 });
  });

  test("a 2-part send with only one part found is partial and nothing changes", async () => {
    const text = "a".repeat(MAX_PART) + "b".repeat(10);
    await unknownSend("s1", text);
    await put(staff("p1", "a".repeat(MAX_PART), SINCE + 1_000));
    expect(await find.execute({ sendId: sid("s1"), chat, since: SINCE, text })).toEqual({ kind: "partial", found: 1, expected: 2 });
    expect(await sourceOf("p1")).toBe("owner_app");
    expect(store.sourceChanges()).toEqual([]);
  });

  test("no candidate is none", async () => {
    await unknownSend("s1", "Hello");
    await put(staff("e1", "Something else", SINCE + 1_000));
    expect(await find.execute({ sendId: sid("s1"), chat, since: SINCE, text: "Hello" })).toEqual({ kind: "none" });
  });

  test("the skew: a message 100 s before since is a candidate, one 200 s before is not", async () => {
    expect(OUTGOING_SKEW_MS).toBe(120_000);
    await unknownSend("near", "Hello");
    await put(staff("e100", "Hello", SINCE - 100_000));
    expect(await find.execute({ sendId: sid("near"), chat, since: SINCE, text: "Hello" })).toEqual({ kind: "found", providerMessageIds: ["e100"] });

    await unknownSend("far", "Bye");
    await put(staff("e200", "Bye", SINCE - 200_000));
    expect(await find.execute({ sendId: sid("far"), chat, since: SINCE, text: "Bye" })).toEqual({ kind: "none" });
    expect(await sourceOf("e200")).toBe("owner_app");
  });

  test("an already sent send is found with its ids; a failed send is none", async () => {
    const sent = OutgoingSend.create({ sendId: sid("done"), chat, text: "Hello", createdAt: SINCE });
    sent.partSent(1, "w1");
    sent.markAllSentIfComplete(SINCE + 1);
    await store.unitOfWork.run(async (r) => {
      await r.outgoing.insert(sent);
      await r.outgoing.savePart(sent, 1, "kapso");
      await r.outgoing.saveSend(sent);
    });
    expect(await find.execute({ sendId: sid("done"), chat, since: SINCE, text: "Hello" })).toEqual({ kind: "found", providerMessageIds: ["w1"] });

    const failed = OutgoingSend.create({ sendId: sid("bad"), chat, text: "Hello", createdAt: SINCE });
    failed.failNothingAccepted("credentials", SINCE + 1);
    await store.unitOfWork.run(async (r) => {
      await r.outgoing.insert(failed);
      await r.outgoing.saveSend(failed);
    });
    await put(staff("e1", "Hello", SINCE + 1_000));
    expect(await find.execute({ sendId: sid("bad"), chat, since: SINCE, text: "Hello" })).toEqual({ kind: "none" });
    expect(await sourceOf("e1")).toBe("owner_app");
  });

  test("a send of another chat, or one that does not exist, is none", async () => {
    await unknownSend("s1", "Hello");
    await put(staff("e1", "Hello", SINCE + 1_000));
    expect(await find.execute({ sendId: sid("s1"), chat: lineChatId(phone("5215512345678")), since: SINCE, text: "Hello" })).toEqual({ kind: "none" });
    expect(await find.execute({ sendId: sid("nope"), chat, since: SINCE, text: "Hello" })).toEqual({ kind: "none" });
  });

  test("a send of another chat is none even when that other chat holds a message with the text", async () => {
    await unknownSend("s1", "Hello");
    const other = lineChatId(phone("5215512345678"));
    await put(staff("elsewhere", "Hello", SINCE + 1_000, { counterpart: "5215512345678" }));
    expect((await store.repos.messages.find({ provider: "kapso", providerMessageId: "elsewhere" }))?.props.chat).toBe(other);
    expect(await find.execute({ sendId: sid("s1"), chat: other, since: SINCE, text: "Hello" })).toEqual({ kind: "none" });
    expect(await sourceOf("elsewhere")).toBe("owner_app");
  });

  test("a message already linked to another send is not a candidate", async () => {
    await unknownSend("s1", "Hello");
    await put(staff("linked", "Hello", SINCE + 1_000));
    store.addOutgoingPart("kapso", "linked", sid("other"), 1);
    expect(await find.execute({ sendId: sid("s1"), chat, since: SINCE, text: "Hello" })).toEqual({ kind: "none" });
    expect(await sourceOf("linked")).toBe("owner_app");
  });

  test("a text that splits into a different number of parts than the send is none", async () => {
    await unknownSend("s1", "Hello");
    await put(staff("e1", "a".repeat(MAX_PART + 5), SINCE + 1_000));
    expect(await find.execute({ sendId: sid("s1"), chat, since: SINCE, text: "a".repeat(MAX_PART + 5) })).toEqual({ kind: "none" });
  });

  test("a text that splits into more parts than the send has is none, even if every piece has a candidate", async () => {
    await unknownSend("s1", "a".repeat(MAX_PART));
    const longer = "a".repeat(MAX_PART) + "b";
    await put(staff("p1", "a".repeat(MAX_PART), SINCE + 1_000), staff("p2", "b", SINCE + 2_000));
    expect(await find.execute({ sendId: sid("s1"), chat, since: SINCE, text: longer })).toEqual({ kind: "none" });
    expect(store.sourceChanges()).toEqual([]);
  });

  test("two parts with identical text cannot both claim the one echo: none, and nothing changes", async () => {
    const part = "a".repeat(MAX_PART);
    const text = part + part;
    await unknownSend("s1", text);
    await put(staff("only", part, SINCE + 1_000));
    expect(await find.execute({ sendId: sid("s1"), chat, since: SINCE, text })).toEqual({ kind: "none" });
    expect(await sourceOf("only")).toBe("owner_app");
    expect(store.sourceChanges()).toEqual([]);
    expect((await store.repos.outgoing.find(sid("s1")))?.props.state).toBe("unknown");
    // two echoes of that text are ambiguous instead
    await put(staff("second", part, SINCE + 2_000));
    expect(await find.execute({ sendId: sid("s1"), chat, since: SINCE, text })).toEqual({ kind: "ambiguous", candidates: 2 });
  });

  test("a text that splits into fewer parts than the send has is none, even if its one piece has a candidate", async () => {
    const part = "a".repeat(MAX_PART);
    await unknownSend("s1", part + "b");
    await put(staff("p1", part, SINCE + 1_000));
    expect(await find.execute({ sendId: sid("s1"), chat, since: SINCE, text: part })).toEqual({ kind: "none" });
    expect(await sourceOf("p1")).toBe("owner_app");
    expect(store.sourceChanges()).toEqual([]);
    expect((await store.repos.outgoing.find(sid("s1")))?.props.state).toBe("unknown");
  });

  test("without the lease it is refused, and no transaction is even opened", async () => {
    await unknownSend("s1", "Hello");
    holder.token = "someone else";
    let opened = 0;
    const counting = new FindOutgoingUseCase({
      lease: new InMemoryOwnerLease(holder, new FakeClock(NOW), "me"),
      unitOfWork: { run: (work) => (opened++, store.unitOfWork.run(work)) },
      clock: new FakeClock(NOW),
    });
    expect(await counting.execute({ sendId: sid("s1"), chat, since: SINCE, text: "Hello" })).toEqual({ kind: "refused", reason: "not_owner" });
    expect(opened).toBe(0);
    expect(await find.execute({ sendId: sid("s1"), chat, since: SINCE, text: "Hello" })).toEqual({ kind: "refused", reason: "not_owner" });
  });
});

import { beforeEach, describe, expect, test } from "bun:test";
import { InMemoryIntakeStore } from "../../../src/intake/adapters/memory/in-memory-intake-store";
import { FindOutgoingUseCase } from "../../../src/intake/application/find-outgoing";
import { SendTextUseCase } from "../../../src/intake/application/send-text";
import { StoreMessages } from "../../../src/intake/application/store-messages";
import { OutgoingSend } from "../../../src/intake/domain/outgoing-send";
import { OwnerNumbers } from "../../../src/intake/domain/owner-numbers";
import type { ProviderMessage } from "../../../src/intake/ports/provider";
import { lineChatId } from "../../../src/shared/chat-id";
import { PhoneNumber } from "../../../src/shared/phone-number";
import { parseSendId, type SendId } from "../../../src/shared/send-id";
import { FakeClock } from "../../support/fake-clock";
import { FakeProvider } from "../../support/fake-provider";
import { InMemoryOwnerLease } from "../../support/in-memory-owner-lease";
import { providerMessage } from "../../support/intake-fixtures";
import { makeDrafts, message } from "./harness";

const draftChats = { "chat-a": [message("a1", "customer", "How much?", 900)] };
type H = ReturnType<typeof makeDrafts>;

/** One waiting draft, listed, approved with the sender answering `unknown`. */
async function unknownSend(): Promise<H> {
  const h = makeDrafts({ chats: draftChats });
  await h.createDraft.run({ kind: "reply", chat: "chat-a", text: "ten" });
  await h.listDrafts.run({});
  h.sender.result = { kind: "unknown", partsSent: 0, partsTotal: 1 };
  return h;
}
const stateOf = async (h: H) => (await h.store.unitOfWork.run((tx) => tx.drafts.get(1), { requireLease: false }))?.snapshot().state;

describe("FRD-03 unknown outcome (RULE-10)", () => {
  test("covers: drafts/FRD-03/EX-21 a send whose outcome is unknown: the owner is told and Deputy does not retry by itself", async () => {
    const h = await unknownSend();
    const out = await h.approveDraft.run({ number: 1, shownText: "ten", ownerWords: "go 1" });
    expect(out).toMatchObject({ ok: true, value: { outcome: "unknown", number: 1 } });
    if (out.ok && out.value.outcome === "unknown") expect(out.value.detail).toContain("may or may not have been sent");
    expect(await stateOf(h)).toBe("unknown");
    await h.retryPendingOutcomes.run();
    expect(h.sender.calls).toHaveLength(1);
  });

  test("covers: drafts/FRD-03/EX-22 Deputy handles an unknown outcome by not retrying it: only the owner's new go sends again", async () => {
    const h = await unknownSend();
    await h.approveDraft.run({ number: 1, shownText: "ten", ownerWords: "go 1" });
    await h.retryPendingOutcomes.run();
    await h.retryPendingOutcomes.run();
    expect(h.sender.calls).toHaveLength(1);
    expect(await stateOf(h)).toBe("unknown");
    await h.listDrafts.run({}); // the unknown outcome cleared the shown mark
    h.sender.result = { kind: "sent" };
    expect(await h.approveDraft.run({ number: 1, shownText: "ten", ownerWords: "go 1 again" })).toMatchObject({ ok: true, value: { outcome: "sent" } });
    expect(h.sender.calls).toHaveLength(2);
  });
});

// ---- the Intake side of RULE-11 and RULE-12 (the provider reports Deputy's own message back)
const CUSTOMER = "5491123456789";
const BUSINESS = "5491100000001";
const NOW = 10_000;
const SINCE = 5_000;
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
const echo = (id: string, text: string, sentAt: number): ProviderMessage =>
  providerMessage({ providerMessageId: id, direction: "outbound", from: BUSINESS, counterpart: CUSTOMER, text, sentAt });

let store: InMemoryIntakeStore;
let service: StoreMessages;
let provider: FakeProvider;
let send: SendTextUseCase;
let find: FindOutgoingUseCase;

beforeEach(async () => {
  const clock = new FakeClock(NOW);
  const lease = new InMemoryOwnerLease({ token: "me", heartbeat: 1 }, clock, "me");
  store = new InMemoryIntakeStore(lease);
  service = new StoreMessages({ clock });
  provider = new FakeProvider("kapso");
  provider.serverTime = 20_000;
  send = new SendTextUseCase({ lease, provider, unitOfWork: store.unitOfWork, store: service, clock });
  find = new FindOutgoingUseCase({ lease, unitOfWork: store.unitOfWork, clock });
  await store.repos.owners.save(OwnerNumbers.of([{ number: phone(BUSINESS), kind: "business", label: "", addedAt: 1 }]), []);
  // a customer wrote first: this gives the chat its destination
  await store.unitOfWork.run((r) => service.store(r, { provider: "kapso", events: [{ kind: "message", message: providerMessage({ from: CUSTOMER, counterpart: CUSTOMER }) }] }));
});

const put = (...messages: ProviderMessage[]) =>
  store.unitOfWork.run((r) => service.store(r, { provider: "kapso", events: messages.map((m) => ({ kind: "message" as const, message: m })) }));
const messagesWithId = async (id: string) => (await store.repos.messages.listChat(chat, {})).filter((m) => m.props.id.providerMessageId === id);
const sourceOf = async (id: string) => (await store.repos.messages.find({ provider: "kapso", providerMessageId: id }))?.props.source;

/** A send of `text` that ended unknown, as a timeout leaves it. */
async function unknownOutgoing(id: string, text: string) {
  const s = OutgoingSend.create({ sendId: sid(id), chat, text, createdAt: SINCE });
  await store.unitOfWork.run((r) => r.outgoing.insert(s));
  s.markPendingUnknown();
  await store.unitOfWork.run(async (r) => {
    for (const p of s.props.parts) await r.outgoing.savePart(s, p.index, "kapso");
    await r.outgoing.saveSend(s);
  });
}

describe("FRD-03 the provider reports Deputy's message back (RULE-11)", () => {
  test("covers: drafts/FRD-03/EX-23 an accepted send reported back later: the chat holds the message once, as sent by Deputy", async () => {
    provider.sendScript = [{ providerMessageId: "wamid.SENT1", serverTime: 20_000 }];
    expect(await send.execute({ sendId: sid("s1"), chat, text: "Hello" })).toEqual({ kind: "sent", providerMessageIds: ["wamid.SENT1"] });
    await put(echo("wamid.SENT1", "Hello", 20_000)); // the provider reports it back
    const same = await messagesWithId("wamid.SENT1");
    expect(same).toHaveLength(1);
    expect(same[0]?.props.source).toBe("sent_through_deputy");
  });

  test("covers: drafts/FRD-03/EX-24 the report arrives before Intake has the send id: one message as sent through Deputy, and the next draft is not held for it", async () => {
    await put(echo("wamid.SENT1", "Hello", 20_000)); // stored as the owner's own message first
    expect(await sourceOf("wamid.SENT1")).toBe("owner_app");
    provider.sendScript = [{ providerMessageId: "wamid.SENT1", serverTime: 20_000 }];
    await send.execute({ sendId: sid("s1"), chat, text: "Hello" });
    const same = await messagesWithId("wamid.SENT1");
    expect(same).toHaveLength(1);
    expect(same[0]?.props.source).toBe("sent_through_deputy");
    expect(store.sourceChanges()).toHaveLength(1);

    // Drafts: a chat whose latest message is Deputy's own send does not hold the next draft
    const h = makeDrafts({ chats: { "chat-a": [message("a1", "customer", "How much?", 900), message("a2", "sent_through_deputy", "Hello", 950)] } });
    await h.createDraft.run({ kind: "reply", chat: "chat-a", text: "ten" });
    await h.listDrafts.run({});
    expect(await h.approveDraft.run({ number: 1, shownText: "ten", ownerWords: "go 1" })).toMatchObject({ ok: true, value: { outcome: "sent" } });
  });
});

describe("FRD-03 resolving an unknown send (RULE-12)", () => {
  test("covers: drafts/FRD-03/EX-26 no matching message after catch-up: nothing is linked, the send stays unknown and nothing is sent again", async () => {
    await unknownOutgoing("s1", "Hello");
    await put(echo("e1", "Something else", SINCE + 1_000));
    expect(await find.execute({ sendId: sid("s1"), chat, since: SINCE, text: "Hello" })).toEqual({ kind: "none" });
    expect((await store.repos.outgoing.find(sid("s1")))?.props.state).toBe("unknown");
    expect(store.sourceChanges()).toEqual([]);
    expect(provider.sent).toHaveLength(0);
    // Drafts side: the unknown draft is not retried by itself
    const h = await unknownSend();
    await h.approveDraft.run({ number: 1, shownText: "ten", ownerWords: "go 1" });
    await h.retryPendingOutcomes.run();
    expect(await stateOf(h)).toBe("unknown");
    expect(h.sender.calls).toHaveLength(1);
  });

  test("covers: drafts/FRD-03/EX-27 two messages with the same text in the window: nothing is linked and the send stays unknown", async () => {
    await unknownOutgoing("s1", "Hello");
    await put(echo("e1", "Hello", SINCE + 1_000), echo("e2", "Hello", SINCE + 2_000));
    expect(await find.execute({ sendId: sid("s1"), chat, since: SINCE, text: "Hello" })).toEqual({ kind: "ambiguous", candidates: 2 });
    expect(await sourceOf("e1")).toBe("owner_app");
    expect(await sourceOf("e2")).toBe("owner_app");
    expect(store.sourceChanges()).toEqual([]);
    expect((await store.repos.outgoing.find(sid("s1")))?.props.state).toBe("unknown");
  });
});

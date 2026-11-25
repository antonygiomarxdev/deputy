import { Secret } from "../../../src/intake/domain/secret";
import { beforeEach, describe, expect, test } from "bun:test";
import { InMemoryIntakeStore } from "../../../src/intake/adapters/memory/in-memory-intake-store";
import { RecordingEventPublisher } from "../../../src/intake/adapters/memory/recording-event-publisher";
import { ReceiveLiveDeliveryUseCase } from "../../../src/intake/application/receive-live-delivery";
import { SendTextUseCase } from "../../../src/intake/application/send-text";
import { StorageFailureLog } from "../../../src/intake/application/storage-failure-log";
import { StoreMessages } from "../../../src/intake/application/store-messages";
import { MAX_PART } from "../../../src/intake/domain/constants";
import { OwnerNumbers } from "../../../src/intake/domain/owner-numbers";
import { ProviderError, type ProviderMessage } from "../../../src/intake/ports/provider";
import { UNATTRIBUTED_CHAT, lineChatId, type ChatId } from "../../../src/shared/chat-id";
import { PhoneNumber } from "../../../src/shared/phone-number";
import type { ProviderName } from "../../../src/shared/provider-name";
import { parseSendId, type SendId } from "../../../src/shared/send-id";
import { FakeClock } from "../../support/fake-clock";
import { FakeProvider } from "../../support/fake-provider";
import { InMemoryOwnerLease, type LeaseHolder } from "../../support/in-memory-owner-lease";
import { providerMessage } from "../../support/intake-fixtures";
import { openSqliteSubject } from "../../support/intake-subjects";

const CUSTOMER = "5491123456789";
const BUSINESS = "5491100000001";
const NOW = 10_000;
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
const owners = () => OwnerNumbers.of([{ number: phone(BUSINESS), kind: "business", label: "", addedAt: 1 }]);
const echo = (id: string, over: Partial<ProviderMessage> = {}): ProviderMessage =>
  providerMessage({ providerMessageId: id, direction: "outbound", from: BUSINESS, counterpart: CUSTOMER, text: "Hello", sentAt: 20_000, ...over });

let holder: LeaseHolder;
let clock: FakeClock;
let store: InMemoryIntakeStore;
let service: StoreMessages;
let provider: FakeProvider;
let send: SendTextUseCase;

async function arrange(name: ProviderName = "kapso") {
  holder = { token: "me", heartbeat: 1 };
  clock = new FakeClock(NOW);
  const lease = new InMemoryOwnerLease(holder, clock, "me");
  store = new InMemoryIntakeStore(lease);
  service = new StoreMessages({ clock });
  provider = new FakeProvider(name);
  provider.serverTime = 20_000;
  send = new SendTextUseCase({ lease, provider, unitOfWork: store.unitOfWork, store: service, clock });
  await store.repos.owners.save(owners(), []);
  // a customer wrote first: this gives the chat its destination
  await store.unitOfWork.run((r) => service.store(r, { provider: name, events: [{ kind: "message", message: providerMessage({ from: CUSTOMER, counterpart: CUSTOMER }) }] }));
}

beforeEach(() => arrange());

const messagesOf = async (c: ChatId = chat) => store.repos.messages.listChat(c, {});
const fail = (kind: ConstructorParameters<typeof ProviderError>[0], retryAfterMs: number | null = null, mayHaveBeenAccepted = false) =>
  new ProviderError(kind, retryAfterMs, mayHaveBeenAccepted);

describe("SendText", () => {
  // covers: intake/FRD-04/EX-15
  test("FR-INTAKE-04-6: one message linked to the send, sentAt the provider time, origin null, the send sent, the ids listed", async () => {
    const r = await send.execute({ sendId: sid("s1"), chat, text: "Hello" });
    expect(r).toEqual({ kind: "sent", providerMessageIds: ["wamid.SENT1"] });
    const m = await store.repos.messages.find({ provider: "kapso", providerMessageId: "wamid.SENT1" });
    expect(m?.props).toMatchObject({ source: "sent_through_deputy", sentAt: 20_000, origin: null, text: "Hello", chat });
    expect((await store.repos.outgoing.find(sid("s1")))?.props.state).toBe("sent");
    expect(await store.repos.outgoing.findByProviderId("kapso", "wamid.SENT1")).toEqual({ sendId: sid("s1"), part: 1 });
    expect(provider.sent.map((s) => [s.to.digits, s.text])).toEqual([[CUSTOMER, "Hello"]]);
  });

  // covers: intake/FRD-04/EX-17
  // covers: intake/FRD-04/EX-18
  test("FR-INTAKE-04-7: the provider's own report of the send, live and in catch-up, stays one message and emits no MessageStored", async () => {
    await send.execute({ sendId: sid("s1"), chat, text: "Hello" });
    const events = new RecordingEventPublisher();
    const lease = new InMemoryOwnerLease(holder, clock, "me");
    const live = new ReceiveLiveDeliveryUseCase({
      lease, provider, receiving: "live", webhookSecret: new Secret("s"), unitOfWork: store.unitOfWork, store: service, events, clock, failures: new StorageFailureLog(),
    });
    provider.deliver(echo("wamid.SENT1"));
    expect((await live.execute({ rawBody: new Uint8Array(), headers: new Map() })).kind).toBe("stored");
    // the catch-up path is the same service called with the same message
    const outcome = await store.unitOfWork.run((r) => service.store(r, { provider: "kapso", events: [{ kind: "message", message: echo("wamid.SENT1") }] }));
    expect(outcome).toMatchObject({ stored: 0, duplicates: 1, summaries: [] });
    expect(events.published).toEqual([]);
    const same = (await messagesOf()).filter((m) => m.props.id.providerMessageId === "wamid.SENT1");
    expect(same).toHaveLength(1);
    expect(same[0]?.props.source).toBe("sent_through_deputy");
  });

  // covers: intake/FRD-04/EX-11
  test("FR-INTAKE-04-13: a report stored as owner_app before the send was recorded is reclassified, once, with no signal", async () => {
    // the provider accepted the send and a catch-up stored its report before SendText recorded the id
    await store.unitOfWork.run((r) => service.store(r, { provider: "kapso", events: [{ kind: "message", message: echo("wamid.SENT1") }] }));
    expect((await store.repos.messages.find({ provider: "kapso", providerMessageId: "wamid.SENT1" }))?.props.source).toBe("owner_app");

    provider.sendScript = [{ providerMessageId: "wamid.SENT1", serverTime: 20_000 }];
    await send.execute({ sendId: sid("s1"), chat, text: "Hello" });

    const same = (await messagesOf()).filter((m) => m.props.id.providerMessageId === "wamid.SENT1");
    expect(same).toHaveLength(1);
    expect(same[0]?.props.source).toBe("sent_through_deputy");
    expect(store.sourceChanges()).toEqual([
      { at: NOW, id: { provider: "kapso", providerMessageId: "wamid.SENT1" }, from: "owner_app", to: "sent_through_deputy", sendId: sid("s1") },
    ]);
  });

  test("a text of 9,000 characters is sent as three parts in order and stored as three messages", async () => {
    const text = "a".repeat(9_000);
    const r = await send.execute({ sendId: sid("s1"), chat, text });
    expect(r).toEqual({ kind: "sent", providerMessageIds: ["wamid.SENT1", "wamid.SENT2", "wamid.SENT3"] });
    expect(provider.sent.map((s) => s.text.length)).toEqual([MAX_PART, MAX_PART, 1_000]);
    expect(provider.sent.map((s) => s.text).join("")).toBe(text);
    const mine = (await messagesOf()).filter((m) => m.props.source === "sent_through_deputy");
    expect(mine).toHaveLength(3);
  });

  describe("failures", () => {
    test("part 2 of 3 fails: unknown with one part sent, and the third part is never sent", async () => {
      provider.sendScript = [{ providerMessageId: "w1", serverTime: 20_000 }, fail("unreachable")];
      const r = await send.execute({ sendId: sid("s1"), chat, text: "a".repeat(9_000) });
      expect(r).toEqual({ kind: "unknown", partsSent: 1, partsTotal: 3 });
      expect(provider.sent).toHaveLength(2);
      const rec = await store.repos.outgoing.find(sid("s1"));
      expect(rec?.props.state).toBe("unknown");
      expect(rec?.props.parts.map((p) => p.state)).toEqual(["sent", "failed", "failed"]);
    });

    test("a repeated send id sends nothing and returns the recorded outcome: sent, failed, unknown", async () => {
      await send.execute({ sendId: sid("ok"), chat, text: "Hello" });
      provider.sendScript = [fail("credentials")];
      await send.execute({ sendId: sid("bad"), chat, text: "Hello" });
      provider.sendScript = [fail("timeout", null, true)];
      await send.execute({ sendId: sid("odd"), chat, text: "Hello" });
      const sentBefore = provider.sent.length;

      expect(await send.execute({ sendId: sid("ok"), chat, text: "Hello" })).toMatchObject({ kind: "sent" });
      expect(await send.execute({ sendId: sid("bad"), chat, text: "Hello" })).toEqual({ kind: "failed", reason: "credentials" });
      expect(await send.execute({ sendId: sid("odd"), chat, text: "Hello" })).toEqual({ kind: "unknown", partsSent: 0, partsTotal: 1 });
      expect(provider.sent).toHaveLength(sentBefore);
    });

    test("a 429 on part 1: rate_limited with retryAt from Retry-After (40 s) or 60 s, the send failed; a repeat answers the same without sending", async () => {
      provider.sendScript = [fail("rate_limited", 40_000)];
      expect(await send.execute({ sendId: sid("a"), chat, text: "Hello" })).toEqual({ kind: "rate_limited", retryAt: NOW + 40_000 });
      expect((await store.repos.outgoing.find(sid("a")))?.props).toMatchObject({ state: "failed", failureReason: "rate_limited" });
      provider.sendScript = [fail("rate_limited")];
      expect(await send.execute({ sendId: sid("b"), chat, text: "Hello" })).toEqual({ kind: "rate_limited", retryAt: NOW + 60_000 });
      await clock.advance(5_000);
      const before = provider.sent.length;
      // the repeat answers with the retry time the first call computed, not the time it finished
      expect(await send.execute({ sendId: sid("a"), chat, text: "Hello" })).toEqual({ kind: "rate_limited", retryAt: NOW + 40_000 });
      expect(await send.execute({ sendId: sid("b"), chat, text: "Hello" })).toEqual({ kind: "rate_limited", retryAt: NOW + 60_000 });
      expect((await store.repos.outgoing.find(sid("a")))?.props).toMatchObject({ finishedAt: NOW, retryAt: NOW + 40_000 });
      expect(provider.sent).toHaveLength(before);
    });

    test("a 429 on part 2 is unknown", async () => {
      provider.sendScript = [{ providerMessageId: "w1", serverTime: 20_000 }, fail("rate_limited", 40_000)];
      expect(await send.execute({ sendId: sid("s1"), chat, text: "a".repeat(5_000) })).toEqual({ kind: "unknown", partsSent: 1, partsTotal: 2 });
    });

    test.each([
      ["credentials", "credentials"],
      ["unreachable", "unreachable"],
      ["quota", "quota"],
      ["bad_response", "rejected"],
    ] as const)("a refusal %s on part 1 fails the send as %s and stores no message", async (kind, reason) => {
      provider.sendScript = [fail(kind)];
      const before = (await messagesOf()).length;
      expect(await send.execute({ sendId: sid("s1"), chat, text: "Hello" })).toEqual({ kind: "failed", reason });
      expect((await messagesOf()).length).toBe(before);
      expect((await store.repos.outgoing.find(sid("s1")))?.props.state).toBe("failed");
    });

    test("a timeout that may have been accepted is unknown with no part sent", async () => {
      provider.sendScript = [fail("timeout", null, true)];
      expect(await send.execute({ sendId: sid("s1"), chat, text: "Hello" })).toEqual({ kind: "unknown", partsSent: 0, partsTotal: 1 });
      expect((await store.repos.outgoing.find(sid("s1")))?.props.parts[0]?.state).toBe("unknown");
    });

    test("a provider error that is not a ProviderError is treated as unknown", async () => {
      provider.sendScript = [new Error("socket hang up")];
      expect(await send.execute({ sendId: sid("s1"), chat, text: "Hello" })).toEqual({ kind: "unknown", partsSent: 0, partsTotal: 1 });
      // it may have gone out, so the part is unknown, not failed
      expect((await store.repos.outgoing.find(sid("s1")))?.props.parts[0]?.state).toBe("unknown");
    });

    test("a chat a send cannot go to is unsupported_chat and writes nothing", async () => {
      const dev = new InMemoryIntakeStore();
      await dev.unitOfWork.run((r) => service.store(r, { provider: "dev", events: [{ kind: "message", message: providerMessage({ from: CUSTOMER, counterpart: CUSTOMER }) }] }));
      // a Kapso send to a chat that holds only dev messages
      const devOnly = new SendTextUseCase({
        lease: new InMemoryOwnerLease(holder, clock, "me"), provider, unitOfWork: dev.unitOfWork, store: service, clock,
      });
      const cases: [string, SendTextUseCaseLike, ChatId][] = [
        ["a group chat", send, "group:123@g.us" as ChatId],
        ["the unattributed chat", send, UNATTRIBUTED_CHAT],
        ["a chat with only dev messages under Kapso", devOnly, chat],
        ["a chat with no known destination", send, lineChatId(phone("5215512345678"))],
      ];
      for (const [name, useCase, c] of cases) {
        expect(await useCase.execute({ sendId: sid(`u-${name}`), chat: c, text: "Hello" })).toEqual({ kind: "failed", reason: "unsupported_chat" });
      }
      expect(provider.sent).toHaveLength(0);
      expect(await store.repos.outgoing.find(sid("u-a group chat"))).toBeNull();
    });

    describe("each reason a destination is refused, on its own (the others would otherwise hide it)", () => {
      const seen = (providerId: string | null) => ({ providerId, conversationRef: null });
      const customer = (counterpart: string, over: Partial<ProviderMessage> = {}) =>
        providerMessage({ providerMessageId: `m-${counterpart}`, from: counterpart, counterpart, ...over });

      test("a group chat whose id would parse as a number", async () => {
        const group = "group:5491199999999" as ChatId;
        await store.unitOfWork.run((r) => service.store(r, { provider: "kapso", events: [{ kind: "message", message: customer("5491199999999", { group: true }) }] }));
        expect((await store.repos.chats.get(group, false))?.providerId).toBe("5491199999999");
        expect(await send.execute({ sendId: sid("g"), chat: group, text: "Hello" })).toEqual({ kind: "failed", reason: "unsupported_chat" });
        expect(provider.sent).toHaveLength(0);
      });

      test("the unattributed chat, even if it were given a destination", async () => {
        await store.unitOfWork.run(async (r) => {
          await r.chats.recompute(UNATTRIBUTED_CHAT, false, NOW, seen("5491199999999"));
          await service.store(r, { provider: "kapso", events: [{ kind: "message", message: providerMessage({ providerMessageId: "x1", direction: "outbound", from: null, counterpart: null }) }] });
        });
        expect((await store.repos.chats.get(UNATTRIBUTED_CHAT, false))?.providerId).toBe("5491199999999");
        expect(await send.execute({ sendId: sid("x"), chat: UNATTRIBUTED_CHAT, text: "Hello" })).toEqual({ kind: "failed", reason: "unsupported_chat" });
        expect(provider.sent).toHaveLength(0);
      });

      test("a chat whose destination is not a phone number", async () => {
        const other = lineChatId(phone("5215512345678"));
        await store.unitOfWork.run(async (r) => {
          await r.chats.recompute(other, false, NOW, seen("not-a-number"));
          await service.store(r, { provider: "kapso", events: [{ kind: "message", message: customer("5215512345678") }] });
        });
        expect((await store.repos.chats.get(other, false))?.providerId).toBe("not-a-number");
        expect(await send.execute({ sendId: sid("n"), chat: other, text: "Hello" })).toEqual({ kind: "failed", reason: "unsupported_chat" });
        expect(provider.sent).toHaveLength(0);
      });

      test("a Kapso chat that holds only dev messages", async () => {
        const other = lineChatId(phone("5215512345678"));
        await store.unitOfWork.run(async (r) => {
          await r.chats.recompute(other, false, NOW, seen("5215512345678"));
          await service.store(r, { provider: "dev", events: [{ kind: "message", message: customer("5215512345678") }] });
        });
        expect((await store.repos.chats.get(other, false))?.providerId).toBe("5215512345678");
        expect((await store.repos.messages.chatExists(other)).hasNonDevMessage).toBe(false);
        expect(await send.execute({ sendId: sid("d"), chat: other, text: "Hello" })).toEqual({ kind: "failed", reason: "unsupported_chat" });
        expect(provider.sent).toHaveLength(0);
      });
    });

    test("an empty text is rejected and leaves no row", async () => {
      expect(await send.execute({ sendId: sid("s1"), chat, text: "" })).toEqual({ kind: "failed", reason: "rejected" });
      expect(await send.execute({ sendId: sid("s2"), chat, text: "   \n" })).toEqual({ kind: "failed", reason: "rejected" });
      expect(await store.repos.outgoing.find(sid("s1"))).toBeNull();
      expect(provider.sent).toHaveLength(0);
    });

    test("without the lease it is refused and nothing is recorded, before the text is looked at", async () => {
      holder.token = "someone else";
      expect(await send.execute({ sendId: sid("e"), chat, text: "" })).toEqual({ kind: "refused", reason: "not_owner" });
      let opened = 0;
      const counting = new SendTextUseCase({
        lease: new InMemoryOwnerLease(holder, clock, "me"),
        provider,
        unitOfWork: { run: (work) => (opened++, store.unitOfWork.run(work)) },
        store: service,
        clock,
      });
      expect(await counting.execute({ sendId: sid("e2"), chat, text: "Hello" })).toEqual({ kind: "refused", reason: "not_owner" });
      expect(opened).toBe(0);
      expect(await send.execute({ sendId: sid("s1"), chat, text: "Hello" })).toEqual({ kind: "refused", reason: "not_owner" });
      expect(provider.sent).toHaveLength(0);
      holder.token = "me";
      expect(await store.repos.outgoing.find(sid("s1"))).toBeNull();
    });
  });
});

type SendTextUseCaseLike = Pick<SendTextUseCase, "execute">;

describe("SendText on the SQLite adapters", () => {
  // covers: intake/FRD-04/EX-19
  // covers: intake/FRD-04/EX-20
  test("FR-INTAKE-04-8: a send changes only outgoing, outgoing_parts, messages and chats, and no Drafts table exists", async () => {
    const s = await openSqliteSubject();
    try {
      const lease = new InMemoryOwnerLease({ token: "me", heartbeat: 1 }, new FakeClock(NOW), "me");
      const p = new FakeProvider("kapso");
      p.serverTime = 20_000;
      const sqlStore = new StoreMessages({ clock: new FakeClock(NOW) });
      await s.repos.owners.save(owners(), []);
      await s.unitOfWork.run((r) => sqlStore.store(r, { provider: "kapso", events: [{ kind: "message", message: providerMessage({ from: CUSTOMER, counterpart: CUSTOMER }) }] }));

      const counts = async (): Promise<Map<string, number>> => {
        const tables = await s.db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
        const out = new Map<string, number>();
        for (const t of tables) {
          const name = String(t["name"]);
          const [row] = await s.db.query(`SELECT COUNT(*) AS n FROM "${name}"`);
          out.set(name, Number(row?.["n"]));
        }
        return out;
      };
      const before = await counts();
      const useCase = new SendTextUseCase({ lease, provider: p, unitOfWork: s.unitOfWork, store: sqlStore, clock: new FakeClock(NOW) });
      expect(await useCase.execute({ sendId: sid("s1"), chat, text: "Hello" })).toMatchObject({ kind: "sent" });
      const after = await counts();

      const changed = [...after].filter(([name, n]) => n !== before.get(name)).map(([name]) => name).sort();
      expect(changed).toEqual(["messages", "outgoing", "outgoing_parts"]);
      const allowed = new Set(["outgoing", "outgoing_parts", "messages", "chats", "source_changes"]);
      for (const name of changed) expect(allowed.has(name)).toBe(true);
      expect([...after.keys()].filter((n) => n.startsWith("draft"))).toEqual([]);
    } finally {
      s.cleanup();
    }
  });
});

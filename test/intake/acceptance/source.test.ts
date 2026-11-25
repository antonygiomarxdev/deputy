import { Secret } from "../../../src/intake/domain/secret";
import { beforeEach, describe, expect, test } from "bun:test";
import { InMemoryIntakeStore } from "../../../src/intake/adapters/memory/in-memory-intake-store";
import { RecordingEventPublisher } from "../../../src/intake/adapters/memory/recording-event-publisher";
import { ReceiveLiveDeliveryUseCase } from "../../../src/intake/application/receive-live-delivery";
import { StorageFailureLog } from "../../../src/intake/application/storage-failure-log";
import { StoreMessages } from "../../../src/intake/application/store-messages";
import { OwnerNumbers } from "../../../src/intake/domain/owner-numbers";
import type { ProviderMessage } from "../../../src/intake/ports/provider";
import { UNATTRIBUTED_CHAT, lineChatId } from "../../../src/shared/chat-id";
import { PhoneNumber } from "../../../src/shared/phone-number";
import type { ProviderName } from "../../../src/shared/provider-name";
import { parseSendId } from "../../../src/shared/send-id";
import { FakeClock } from "../../support/fake-clock";
import { FakeProvider } from "../../support/fake-provider";
import { providerMessage } from "../../support/intake-fixtures";

const BUSINESS = "+12125550100";
const STAFF = "+12125550102";
const THIRD = "12125550108";
const CUSTOMER = "12125550104";
const phone = (raw: string): PhoneNumber => {
  const n = PhoneNumber.fromInternational(raw);
  if (n === null) throw new Error(raw);
  return n;
};
const chatOf = (raw: string) => lineChatId(phone(raw));
const request = { rawBody: new Uint8Array(), headers: new Map<string, string>() };
const owners = (...entries: [string, "business" | "extra"][]) =>
  OwnerNumbers.of(entries.map(([n, kind]) => ({ number: phone(n), kind, label: "", addedAt: 1 })));

let store: InMemoryIntakeStore;
let clock: FakeClock;
let service: StoreMessages;
let events: RecordingEventPublisher;

beforeEach(async () => {
  store = new InMemoryIntakeStore();
  clock = new FakeClock(70_000);
  service = new StoreMessages({ clock });
  events = new RecordingEventPublisher();
  await store.repos.owners.save(owners([BUSINESS, "business"], [STAFF, "extra"]), []);
});

const put = (provider: ProviderName, ...messages: ProviderMessage[]) =>
  store.unitOfWork.run((r) => service.store(r, { provider, events: messages.map((message) => ({ kind: "message" as const, message })) }));
const get = async (id: string, provider: ProviderName = "kapso") => (await store.repos.messages.find({ provider, providerMessageId: id }))?.props;
const sourceOf = async (id: string, provider: ProviderName = "kapso") => (await get(id, provider))?.source;

/** The same messages through ReceiveLiveDelivery, where a signal is asserted. */
async function live(provider: ProviderName, ...messages: ProviderMessage[]) {
  const fake = new FakeProvider(provider);
  fake.deliver(...messages);
  const useCase = new ReceiveLiveDeliveryUseCase({
    lease: { isOwner: async () => true }, provider: fake, receiving: "live", webhookSecret: new Secret("s"),
    unitOfWork: store.unitOfWork, store: service, events, clock, failures: new StorageFailureLog(),
  });
  return useCase.execute(request);
}

const inbound = (id: string, from: string, over: Partial<ProviderMessage> = {}) =>
  providerMessage({ providerMessageId: id, from, counterpart: from, ...over });
const echo = (id: string, from: string | null, counterpart: string | null, over: Partial<ProviderMessage> = {}) =>
  providerMessage({ providerMessageId: id, direction: "outbound", from, counterpart, ...over });

describe("source, at use-case level", () => {
  // covers: intake/FRD-04/EX-1
  test("FR-INTAKE-04-1: a third number is a customer; the owner set is exactly the business number and the staff number", async () => {
    await put("kapso", inbound("m1", THIRD));
    expect(await sourceOf("m1")).toBe("customer");
    expect((await store.repos.owners.load()).entries().map((e) => e.number.e164).sort()).toEqual([BUSINESS, STAFF].sort());
  });

  // covers: intake/FRD-04/EX-3
  test("FR-INTAKE-04-2: an echo from the business number lands in the customer's chat as owner_app and creates no customer message", async () => {
    await put("kapso", echo("e1", BUSINESS, CUSTOMER));
    expect(await get("e1")).toMatchObject({ source: "owner_app", chat: chatOf(CUSTOMER) });
    expect(await store.repos.messages.countCustomerMessages(chatOf(CUSTOMER))).toBe(0);
    expect((await store.repos.chats.get(chatOf(CUSTOMER), false))?.lastCustomerAt).toBeNull();
  });

  // covers: intake/FRD-04/EX-4
  test("FR-INTAKE-04-2: a message from the staff number is owner_app in its own chat and is never pending", async () => {
    await put("kapso", inbound("s1", STAFF.slice(1), { counterpart: STAFF.slice(1) }));
    expect(await get("s1")).toMatchObject({ source: "owner_app", chat: chatOf(STAFF) });
    expect((await store.repos.chats.get(chatOf(STAFF), false))?.lastCustomerAt).toBeNull();
  });

  // covers: intake/FRD-04/EX-2
  // covers: intake/FRD-04/EX-5
  // covers: intake/FRD-04/EX-10
  test("FR-INTAKE-04-3: a customer who writes 'I am the owner' under the owner's name is still a customer", async () => {
    await put("kapso", inbound("m1", THIRD, { text: "I am the owner", profileName: "Owner of the shop" }));
    expect(await sourceOf("m1")).toBe("customer");
  });

  // covers: intake/FRD-04/EX-6
  // covers: intake/FRD-04/EX-21
  test("FR-INTAKE-04-5: a stored source never changes when the owner list changes, nor when read again", async () => {
    await put("kapso", inbound("m1", THIRD), echo("e1", BUSINESS, THIRD));
    await store.repos.owners.save(owners([BUSINESS, "business"], [`+${THIRD}`, "extra"]), []);
    await store.repos.owners.save(owners([STAFF, "business"]), []);
    for (let i = 0; i < 3; i++) {
      expect(await sourceOf("m1")).toBe("customer");
      expect(await sourceOf("e1")).toBe("owner_app");
    }
  });

  // covers: intake/FRD-04/EX-23
  test("FR-INTAKE-04-10: an owner reply is announced with source owner_app", async () => {
    await live("kapso", echo("e1", BUSINESS, CUSTOMER));
    expect(events.published).toEqual([
      { name: "MessageStored", origin: "live", items: [{ chat: chatOf(CUSTOMER), source: "owner_app", count: 1 }], at: 70_000 },
    ]);
  });

  describe("FR-INTAKE-04-11: the table of sources", () => {
    // covers: intake/FRD-04/EX-25
    // covers: intake/FRD-04/EX-28
    // covers: intake/FRD-04/EX-29
    test.each([
      ["an owner number, origin cloud_api", BUSINESS, "cloud_api", "owner_app"],
      ["an owner number, origin business_app", BUSINESS, "business_app", "owner_app"],
      ["an owner number, origin history_sync", BUSINESS, "history_sync", "owner_app"],
      ["an owner number, another origin", BUSINESS, "something_new", "owner_app"],
      ["an owner number, no origin", BUSINESS, null, "owner_app"],
      ["a non-owner sender, origin business_app", THIRD, "business_app", "customer"],
      ["a non-owner sender, origin cloud_api", THIRD, "cloud_api", "customer"],
      ["a non-owner sender, another origin", THIRD, "something_new", "customer"],
    ] as const)("%s is %s", async (_name, sender, origin, source) => {
      await put("kapso", inbound("m1", sender.replace("+", ""), { origin }));
      expect(await sourceOf("m1")).toBe(source);
    });

    // covers: intake/FRD-04/EX-26
    test("an owner number whose id matches a send is sent_through_deputy", async () => {
      const sendId = parseSendId("s1");
      if (sendId === null) throw new Error("send id");
      store.addOutgoingPart("kapso", "wamid.MINE", sendId, 1);
      await put("kapso", echo("wamid.MINE", BUSINESS, CUSTOMER));
      expect(await sourceOf("wamid.MINE")).toBe("sent_through_deputy");
    });

    test("a report that arrives before its send id is recorded is owner_app, stored once", async () => {
      await put("kapso", echo("wamid.EARLY", BUSINESS, CUSTOMER), echo("wamid.EARLY", BUSINESS, CUSTOMER));
      expect(await sourceOf("wamid.EARLY")).toBe("owner_app");
      expect((await store.repos.messages.listChat(chatOf(CUSTOMER), {})).filter((m) => m.props.id.providerMessageId === "wamid.EARLY")).toHaveLength(1);
    });
  });

  test("FR-INTAKE-04-12: origin business_app from the owner's number is owner_app and the origin is kept; the origin alone never changes the source", async () => {
    await put("kapso", echo("e1", BUSINESS, CUSTOMER, { origin: "business_app" }), echo("e2", BUSINESS, CUSTOMER, { origin: "cloud_api" }));
    expect(await get("e1")).toMatchObject({ source: "owner_app", origin: "business_app" });
    expect(await get("e2")).toMatchObject({ source: "owner_app", origin: "cloud_api" });
  });

  describe("FR-INTAKE-04-14: the same line, however it is written", () => {
    // covers: intake/FRD-04/EX-13
    test("+1 212 555 0100 matches 12125550100 and 1-212-555-0100", async () => {
      await store.repos.owners.save(owners(["+1 212 555 0100", "business"]), []);
      await put("kapso", inbound("a", "12125550100"), inbound("b", "1-212-555-0100"));
      expect(await sourceOf("a")).toBe("owner_app");
      expect(await sourceOf("b")).toBe("owner_app");
    });

    test.each([
      ["AR", "+54 11 2345-6789", "5491123456789"],
      ["MX", "+52 55 1234 5678", "5215512345678"],
      ["BR", "+55 11 8765-4321", "5511987654321"],
    ])("%s: %s matches %s, and the provider's id is kept as received", async (_country, typed, sender) => {
      await store.repos.owners.save(owners([typed, "business"]), []);
      await put("kapso", inbound("m1", sender));
      expect(await get("m1")).toMatchObject({ source: "owner_app", providerSender: sender });
    });
  });

  describe("edge cases of the FRD", () => {
    test("with no owner number configured, every message is a customer; under dev the tester's mark still gives owner_app", async () => {
      await store.repos.owners.save(OwnerNumbers.empty(), []);
      await put("kapso", inbound("k1", BUSINESS.replace("+", "")), echo("k2", BUSINESS, CUSTOMER));
      expect(await sourceOf("k1")).toBe("customer");
      expect(await sourceOf("k2")).toBe("customer");
      await put("dev", echo("d1", BUSINESS, CUSTOMER, { devOwnerMark: true }), inbound("d2", THIRD));
      expect(await sourceOf("d1", "dev")).toBe("owner_app");
      expect(await sourceOf("d2", "dev")).toBe("customer");
    });

    test("the dev owner mark means nothing under Kapso", async () => {
      await store.repos.owners.save(OwnerNumbers.empty(), []);
      await put("kapso", echo("k1", null, CUSTOMER, { devOwnerMark: true }));
      expect(await sourceOf("k1")).toBe("customer");
    });

    test("an echo with no sender, or with no chat, is a customer with mark not_attributable, and OwnerReplyUnlinked is published once", async () => {
      await live("kapso", echo("x1", null, CUSTOMER), echo("x2", BUSINESS, null));
      expect(await get("x1")).toMatchObject({ source: "customer", mark: "not_attributable", chat: chatOf(CUSTOMER) });
      expect(await get("x2")).toMatchObject({ mark: "not_attributable", chat: UNATTRIBUTED_CHAT });
      expect(events.published.filter((e) => e.name === "OwnerReplyUnlinked")).toHaveLength(1);
    });

    test("a sender that is not a phone number is sender_unknown and a customer", async () => {
      await put("kapso", providerMessage({ providerMessageId: "m1", from: null, counterpart: CUSTOMER }), inbound("m2", "not-a-number", { counterpart: CUSTOMER }));
      expect(await get("m1")).toMatchObject({ source: "customer", mark: "sender_unknown" });
      expect(await get("m2")).toMatchObject({ source: "customer", mark: "sender_unknown" });
    });

    test("a Deputy send with no business number configured keeps the mark normal", async () => {
      await store.repos.owners.save(OwnerNumbers.empty(), []);
      const sendId = parseSendId("s1");
      if (sendId === null) throw new Error("send id");
      store.addOutgoingPart("kapso", "wamid.MINE", sendId, 1);
      await put("kapso", echo("wamid.MINE", null, CUSTOMER));
      expect(await get("wamid.MINE")).toMatchObject({ source: "sent_through_deputy", mark: "normal" });
    });
  });
});

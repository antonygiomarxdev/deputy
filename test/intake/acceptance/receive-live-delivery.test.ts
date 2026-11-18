import { Secret } from "../../../src/intake/domain/secret";
import { beforeEach, describe, expect, test } from "bun:test";
import { InMemoryIntakeStore } from "../../../src/intake/adapters/memory/in-memory-intake-store";
import { RecordingEventPublisher } from "../../../src/intake/adapters/memory/recording-event-publisher";
import { ReceiveLiveDeliveryUseCase } from "../../../src/intake/application/receive-live-delivery";
import { StorageFailureLog } from "../../../src/intake/application/storage-failure-log";
import { StoreMessages } from "../../../src/intake/application/store-messages";
import { OwnerNumbers } from "../../../src/intake/domain/owner-numbers";
import type { EventPublisher } from "../../../src/intake/ports/event-publisher";
import type { IntakeUnitOfWork } from "../../../src/intake/ports/intake-unit-of-work";
import type { ProviderMessage } from "../../../src/intake/ports/provider";
import { parseChatId } from "../../../src/shared/chat-id";
import { PhoneNumber } from "../../../src/shared/phone-number";
import { parseSendId } from "../../../src/shared/send-id";
import { FakeClock } from "../../support/fake-clock";
import { FakeProvider } from "../../support/fake-provider";
import { providerMessage } from "../../support/intake-fixtures";

const OWNER = "+5491100000000";
const CHAT = (() => {
  const c = parseChatId("+541123456789");
  if (!c) throw new Error("chat");
  return c;
})();
const request = { rawBody: new TextEncoder().encode("{}"), headers: new Map<string, string>() };

describe("ReceiveLiveDelivery", () => {
  let store: InMemoryIntakeStore;
  let provider: FakeProvider;
  let events: RecordingEventPublisher;
  let clock: FakeClock;
  let failures: StorageFailureLog;
  let isOwner: boolean;

  beforeEach(async () => {
    store = new InMemoryIntakeStore();
    provider = new FakeProvider("kapso");
    events = new RecordingEventPublisher();
    clock = new FakeClock(70_000);
    failures = new StorageFailureLog();
    isOwner = true;
    const owner = PhoneNumber.fromInternational(OWNER);
    if (!owner) throw new Error("owner");
    await store.owners.save(OwnerNumbers.of([{ number: owner, kind: "business", label: "", addedAt: 1 }]), []);
  });

  const build = (over: { receiving?: "catch_up" | "live"; unitOfWork?: IntakeUnitOfWork; publisher?: EventPublisher; webhookSecret?: Secret | null } = {}) =>
    new ReceiveLiveDeliveryUseCase({
      lease: { isOwner: async () => isOwner },
      provider,
      receiving: over.receiving ?? "live",
      webhookSecret: over.webhookSecret === undefined ? new Secret("secret") : over.webhookSecret,
      unitOfWork: over.unitOfWork ?? store.unitOfWork,
      store: new StoreMessages({ clock }),
      events: over.publisher ?? events,
      clock,
      failures,
    });
  const find = (id: string, name: "kapso" | "dev" = "kapso") => store.repos.messages.find({ provider: name, providerMessageId: id });

  test("FR-INTAKE-02-1: a valid delivery is stored and announced once, after the commit", async () => {
    provider.deliver(providerMessage());
    const result = await build().execute(request);
    expect(result).toEqual({ kind: "stored", stored: 1, duplicates: 0, ignored: 0 });
    expect(await find("m1")).not.toBeNull();
    expect(events.published).toEqual([
      { name: "MessageStored", origin: "live", items: [{ chat: CHAT, source: "customer", count: 1 }], at: 70_000 },
    ]);
    expect(provider.verifyCalls[0]?.secret).toBe("secret");
  });

  test("FR-INTAKE-02-2: each failed verification writes one note and stores nothing", async () => {
    for (const kind of ["bad_signature", "missing_signature", "no_secret", "malformed"] as const) {
      provider.parsed = { kind };
      expect(await build().execute(request)).toEqual({ kind: "rejected", reason: kind });
    }
    const { notes } = await store.repos.rejections.list();
    expect(notes.map((n) => n.reason).sort()).toEqual(["bad_signature", "malformed", "missing_signature", "no_secret"]);
    expect(notes.every((n) => !n.recoverable)).toBe(true);
    expect(await store.repos.messages.chatExists(CHAT)).toEqual({ exists: false, hasNonDevMessage: false });
    expect(events.published).toEqual([]);
  });

  test("FR-INTAKE-02-1: only a delivery with a valid signature sets liveVerifiedAt", async () => {
    for (const kind of ["bad_signature", "missing_signature", "no_secret"] as const) {
      provider.parsed = { kind };
      await build().execute(request);
    }
    expect(await store.repos.syncState.liveVerifiedAt("kapso")).toBeNull();
    provider.deliver(providerMessage());
    await build().execute(request);
    expect(await store.repos.syncState.liveVerifiedAt("kapso")).toBe(70_000);
  });

  test("StoreMessages alone does not set liveVerifiedAt", async () => {
    await store.unitOfWork.run((r) =>
      new StoreMessages({ clock }).store(r, { provider: "kapso", events: [{ kind: "message", message: providerMessage() }] }),
    );
    expect(await store.repos.syncState.liveVerifiedAt("kapso")).toBeNull();
  });

  test("FR-INTAKE-02-7: the same delivery three times is one row and one MessageStored", async () => {
    provider.deliver(providerMessage());
    const results = [await build().execute(request), await build().execute(request), await build().execute(request)];
    expect(results.map((r) => (r.kind === "stored" ? r.duplicates : -1))).toEqual([0, 1, 1]);
    expect(await store.repos.messages.listChat(CHAT, {})).toHaveLength(1);
    expect(events.published.filter((e) => e.name === "MessageStored")).toHaveLength(1);
  });

  describe("FR-INTAKE-02-11: receiving mode", () => {
    test("Kapso on catch-up answers live_off and stores nothing", async () => {
      provider.deliver(providerMessage());
      expect(await build({ receiving: "catch_up" }).execute(request)).toEqual({ kind: "live_off" });
      expect(provider.verifyCalls).toHaveLength(0);
      expect(await find("m1")).toBeNull();
    });

    test("dev stores whatever receiving says", async () => {
      provider = new FakeProvider("dev");
      provider.deliver(providerMessage());
      expect((await build({ receiving: "catch_up" }).execute(request)).kind).toBe("stored");
      expect(await find("m1", "dev")).not.toBeNull();
    });
  });

  test("FR-INTAKE-02-9: a Deputy send or a repeat is not announced; an unlinked owner echo is, once", async () => {
    const sendId = parseSendId("s1");
    if (!sendId) throw new Error("send id");
    store.addOutgoingPart("kapso", "deputy-1", sendId, 1);
    provider.deliver(providerMessage({ providerMessageId: "deputy-1", direction: "outbound", from: null }));
    await build().execute(request);
    expect(events.published).toEqual([]);

    const echo = providerMessage({ providerMessageId: "echo", direction: "outbound", from: null, counterpart: null });
    provider.deliver(echo);
    await build().execute(request);
    await build().execute(request);
    expect(events.published.map((e) => e.name)).toEqual(["MessageStored", "OwnerReplyUnlinked"]);
    const stored = events.published[0];
    expect(stored?.name === "MessageStored" && stored.items.map((i) => i.source)).toEqual(["customer"]);
  });

  describe("storage failure", () => {
    test("is reported, logged by time, and announces nothing", async () => {
      provider.deliver(providerMessage());
      const failing: IntakeUnitOfWork = { run: async () => Promise.reject(new Error("disk full")) };
      expect(await build({ unitOfWork: failing }).execute(request)).toEqual({ kind: "storage_failed" });
      expect(failures.last()).toBe(70_000);
      expect(events.published).toEqual([]);
    });

    test("a subscriber that throws does not undo the store", async () => {
      provider.deliver(providerMessage());
      const throwing: EventPublisher = {
        publish() {
          throw new Error("subscriber bug");
        },
      };
      expect((await build({ publisher: throwing }).execute(request)).kind).toBe("stored");
      expect(await find("m1")).not.toBeNull();
      expect(failures.last()).toBeNull();
    });
  });

  test("a MessageStored subscriber that throws does not skip OwnerReplyUnlinked", async () => {
    provider.deliver(providerMessage({ providerMessageId: "echo", direction: "outbound", from: null, counterpart: null }));
    const seen: string[] = [];
    const flaky: EventPublisher = {
      publish(e) {
        if (e.name === "MessageStored") throw new Error("subscriber bug");
        seen.push(e.name);
      },
    };
    expect((await build({ publisher: flaky }).execute(request)).kind).toBe("stored");
    expect(seen).toEqual(["OwnerReplyUnlinked"]);
  });

  test("not the owner: refused, nothing read or stored", async () => {
    isOwner = false;
    provider.deliver(providerMessage());
    expect(await build().execute(request)).toEqual({ kind: "refused", reason: "not_owner" });
    expect(provider.verifyCalls).toHaveLength(0);
    expect(await find("m1")).toBeNull();
  });

  test("FR-INTAKE-02-14: a live delivery and a catch-up page store the same row, except storedAt", async () => {
    const fixtures: ProviderMessage[] = [
      providerMessage({ providerMessageId: "a", sentAt: 100, profileName: "Ana" }),
      providerMessage({ providerMessageId: "b", sentAt: 200, direction: "outbound", from: OWNER, origin: "business_app" }),
      providerMessage({ providerMessageId: "c", type: "audio", text: null, transcript: "hi", sentAt: 300 }),
    ];
    const other = new InMemoryIntakeStore();
    await other.owners.save(await store.owners.load(), []);
    const later = new FakeClock(99_000);
    await other.unitOfWork.run((r) =>
      new StoreMessages({ clock: later }).store(r, { provider: "kapso", events: fixtures.map((message) => ({ kind: "message", message })) }),
    );
    provider.deliver(...fixtures);
    await build().execute(request);
    const live = await store.repos.messages.listChat(CHAT, {});
    const catchUp = await other.repos.messages.listChat(CHAT, {});
    expect(live).toHaveLength(3);
    const strip = (m: (typeof live)[number]) => ({ ...m.props, storedAt: 0 });
    expect(live.map(strip)).toEqual(catchUp.map(strip));
    expect(await store.repos.chats.get(CHAT, false)).toMatchObject({ profileName: "Ana" });
  });
});

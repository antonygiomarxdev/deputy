import { beforeEach, describe, expect, test } from "bun:test";
import { DevProvider } from "../../../src/intake/adapters/dev/dev-provider";
import { InMemoryIntakeSettingsRepository } from "../../../src/intake/adapters/memory/in-memory-intake-settings-repository";
import { InMemoryIntakeStore } from "../../../src/intake/adapters/memory/in-memory-intake-store";
import { RecordingEventPublisher } from "../../../src/intake/adapters/memory/recording-event-publisher";
import { CatchUpUseCase, type RunResult } from "../../../src/intake/application/catch-up";
import { GetSyncStatusUseCase } from "../../../src/intake/application/get-sync-status";
import { RunCoordinator } from "../../../src/intake/application/run-coordinator";
import { StorageFailureLog } from "../../../src/intake/application/storage-failure-log";
import { StoreMessages } from "../../../src/intake/application/store-messages";
import { OwnerNumbers } from "../../../src/intake/domain/owner-numbers";
import type { IntakeRepos, IntakeUnitOfWork } from "../../../src/intake/ports/intake-unit-of-work";
import type { IntakeSettingsRepository } from "../../../src/intake/ports/intake-settings-repository";
import type { Provider, ProviderMessage } from "../../../src/intake/ports/provider";
import { parseChatId } from "../../../src/shared/chat-id";
import { PhoneNumber } from "../../../src/shared/phone-number";
import { FakeClock } from "../../support/fake-clock";
import { FakeProvider } from "../../support/fake-provider";
import { providerMessage } from "../../support/intake-fixtures";
import { openSqliteSubject } from "../../support/intake-subjects";

const DAY = 86_400_000;
const OWNER = "+5491100000000";
const CHAT = (() => {
  const c = parseChatId("+541123456789");
  if (!c) throw new Error("chat");
  return c;
})();
const msg = (id: string, sentAt: number, over: Partial<ProviderMessage> = {}): ProviderMessage =>
  providerMessage({ providerMessageId: id, sentAt, conversationRef: "c1", ...over });
const echo = (id: string, sentAt: number, over: Partial<ProviderMessage> = {}): ProviderMessage =>
  msg(id, sentAt, { direction: "outbound", from: OWNER, ...over });

describe("CatchUp", () => {
  let store: InMemoryIntakeStore;
  let provider: FakeProvider;
  let clock: FakeClock;
  let publisher: RecordingEventPublisher;
  let isOwner: boolean;

  beforeEach(async () => {
    store = new InMemoryIntakeStore();
    provider = new FakeProvider("kapso");
    clock = new FakeClock(1_000_000);
    publisher = new RecordingEventPublisher();
    isOwner = true;
    const owner = PhoneNumber.fromInternational(OWNER);
    if (!owner) throw new Error("owner");
    await store.owners.save(OwnerNumbers.of([{ number: owner, kind: "business", label: "", addedAt: 1 }]), []);
  });

  const build = (over: { provider?: Provider; uow?: IntakeUnitOfWork; reads?: IntakeRepos; settings?: IntakeSettingsRepository } = {}) => {
    const coordinator = new RunCoordinator<RunResult>(clock);
    const prov = over.provider ?? provider;
    const reads = over.reads ?? store.repos;
    const status = new GetSyncStatusUseCase({
      provider: prov.name,
      reads,
      settings: over.settings ?? new InMemoryIntakeSettingsRepository(),
      coordinator,
      failures: new StorageFailureLog(),
      clock,
    });
    return new CatchUpUseCase({
      provider: prov,
      clock,
      lease: { isOwner: async () => isOwner },
      uow: over.uow ?? store.unitOfWork,
      reads,
      store: new StoreMessages({ clock }),
      publisher,
      coordinator,
      status,
    });
  };
  const messageStored = () => publisher.published.filter((e) => e.name === "MessageStored");
  const finished = () => publisher.published.filter((e) => e.name === "CatchUpFinished");
  const rows = async () => (await store.repos.messages.listChat(CHAT, {})).map((m) => m.props.id.providerMessageId);

  test("FR-INTAKE-03-1: the first run stores three customer messages and an owner reply, listing from the start", async () => {
    provider.serverTime = 10_000;
    provider.hold("c1", "5491123456789", [msg("a", 100), msg("b", 200), msg("c", 300), echo("o", 250)]);
    const result = await build().execute({ trigger: "start" });
    expect(result).toMatchObject({ kind: "finished", stored: 4 });
    expect(await rows()).toEqual(["a", "b", "o", "c"]);
    expect(provider.calls[0]).toEqual({ kind: "conversations", activeAfter: null, cursor: null });
    expect((await store.repos.messages.find({ provider: "kapso", providerMessageId: "o" }))?.props.source).toBe("owner_app");
  });

  test("FR-INTAKE-03-2: what arrived while Deputy was off is stored by the next session", async () => {
    provider.serverTime = 10_000;
    provider.hold("c1", "5491123456789", [msg("a", 100)]);
    await build().execute({ trigger: "start" });
    provider.serverTime = 20_000;
    provider.hold("c1", "5491123456789", [msg("a", 100), msg("later", 15_000)]);
    const second = await build().execute({ trigger: "start" });
    expect(second).toMatchObject({ kind: "finished", stored: 1 });
    expect(await rows()).toEqual(["a", "later"]);
  });

  test("FR-INTAKE-03-4: SPEC-02 rules apply to listed messages (readable, duplicates, order, owner echo)", async () => {
    provider.serverTime = 10_000;
    provider.hold("c1", "5491123456789", [
      msg("img", 300, { type: "image", text: null }),
      msg("late", 400),
      msg("early", 100),
      msg("dup", 200),
      msg("dup", 200),
      echo("o", 350),
    ]);
    await build().execute({ trigger: "start" });
    expect(await rows()).toEqual(["early", "dup", "img", "o", "late"]);
    const props = async (id: string) => (await store.repos.messages.find({ provider: "kapso", providerMessageId: id }))?.props;
    expect(await props("img")).toMatchObject({ readable: false, source: "customer" });
    expect(await props("o")).toMatchObject({ source: "owner_app" });
  });

  test("FR-INTAKE-03-5: one folded MessageStored for a run that stores messages, none otherwise; CatchUpFinished always", async () => {
    provider.serverTime = 10_000;
    provider.hold("c1", "5491123456789", [msg("a", 100)]);
    await build().execute({ trigger: "start" });
    expect(messageStored()).toHaveLength(0); // history only
    expect(finished()).toHaveLength(1);

    provider.serverTime = 20_000;
    provider.hold("c1", "5491123456789", [msg("a", 100), msg("n1", 12_000), msg("n2", 13_000), echo("n3", 14_000)]);
    await build().execute({ trigger: "timer" });
    expect(messageStored()).toHaveLength(1);
    const stored = messageStored()[0];
    expect(stored?.name === "MessageStored" && stored.origin).toBe("catch_up");
    expect(stored?.name === "MessageStored" && stored.items).toEqual([
      { chat: CHAT, source: "customer", count: 2 },
      { chat: CHAT, source: "owner_app", count: 1 },
    ]);
    expect(finished()).toHaveLength(2);

    provider.serverTime = 30_000;
    await build().execute({ trigger: "timer" });
    expect(messageStored()).toHaveLength(1);
    expect(finished()).toHaveLength(3);
    const last = finished()[2];
    expect(last?.name === "CatchUpFinished" && [last.status, last.reason, last.storedCount]).toEqual(["complete", null, 0]);
  });

  test("FR-INTAKE-03-9: asking again with nothing new adds no row and no signal; concurrent calls share one run", async () => {
    provider.serverTime = 10_000;
    provider.hold("c1", "5491123456789", [msg("a", 100)]);
    const useCase = build();
    const [one, two] = await Promise.all([useCase.execute({ trigger: "asked" }), useCase.execute({ trigger: "asked" })]);
    expect(provider.calls.filter((c) => c.kind === "conversations")).toHaveLength(1);
    expect(one.kind).toBe("finished");
    expect(two).toEqual(one);

    const before = await rows();
    publisher.published.length = 0;
    await useCase.execute({ trigger: "asked" });
    expect(await rows()).toEqual(before);
    expect(messageStored()).toHaveLength(0);
  });

  test("FR-INTAKE-03-11 and 12: the first import marks history by connect time and announces none of it", async () => {
    provider.serverTime = 100 * DAY;
    provider.hold("c1", "5491123456789", [
      msg("old-1", 10 * DAY),
      msg("old-2", 50 * DAY, { origin: "cloud_api" }),
      msg("flagged", 99 * DAY, { origin: "history_sync" }),
      msg("fresh", 100 * DAY + 1_000),
    ]);
    await build().execute({ trigger: "start" });
    const history = async (id: string) => (await store.repos.messages.find({ provider: "kapso", providerMessageId: id }))?.props.history;
    expect([await history("old-1"), await history("old-2"), await history("flagged"), await history("fresh")]).toEqual([true, true, true, false]);
    expect(messageStored()).toHaveLength(1);
    const e = messageStored()[0];
    expect(e?.name === "MessageStored" && e.items).toEqual([{ chat: CHAT, source: "customer", count: 1 }]);
    const done = finished()[0];
    expect(done?.name === "CatchUpFinished" && done.storedCount).toBe(4);
  });

  test("a conversation is read newest first and stops at the page that holds an item older than the window", async () => {
    provider.serverTime = 2_000_000;
    await build().execute({ trigger: "start" }); // mark 2,000,000: the next window starts at 2,000,000 - OVERLAP_MS = 1,400,000
    provider.serverTime = 3_000_000;
    provider.pageSize = 2;
    provider.hold("c1", "5491123456789", [
      msg("n1", 2_900_000),
      msg("n2", 2_800_000),
      msg("mid", 2_000_000),
      msg("old", 1_000_000), // page 2 holds this item, older than the window: the conversation stops here
      msg("ancient", 500_000), // page 3: never requested
    ]);
    provider.calls.length = 0;
    await build().execute({ trigger: "timer" });
    const reads = provider.calls.filter((c) => c.kind === "messages");
    expect(reads.map((c) => (c.cursor === null ? null : String(c.cursor)))).toEqual([null, "2"]);
    expect(await rows()).toEqual(["old", "mid", "n2", "n1"]);
  });

  test("FR-INTAKE-03-17: a message already stored live is not stored or signalled again", async () => {
    provider.serverTime = 10_000;
    await store.unitOfWork.run((r) =>
      new StoreMessages({ clock }).store(r, { provider: "kapso", events: [{ kind: "message", message: msg("live", 20_000) }] }),
    );
    provider.serverTime = 30_000;
    provider.hold("c1", "5491123456789", [msg("live", 20_000)]);
    const result = await build().execute({ trigger: "timer" });
    expect(result).toMatchObject({ kind: "finished", stored: 0 });
    expect(await rows()).toEqual(["live"]);
    expect(messageStored()).toHaveLength(0);
  });

  test("connectedAt is saved before the first message is stored", async () => {
    provider.serverTime = 10_000;
    provider.hold("c1", "5491123456789", [msg("a", 100)]);
    const seen: Array<number | null> = [];
    const spying: IntakeUnitOfWork = {
      run: (work) =>
        store.unitOfWork.run((r) =>
          work({
            ...r,
            messages: {
              ...r.messages,
              insertIfNew: async (m) => {
                seen.push(await r.syncState.connectedAt("kapso"));
                return r.messages.insertIfNew(m);
              },
            },
          }),
        ),
    };
    await build({ uow: spying }).execute({ trigger: "start" });
    expect(seen).toEqual([10_000]);
  });

  test("not the owner: refused, and the provider is never called", async () => {
    isOwner = false;
    expect(await build().execute({ trigger: "start" })).toEqual({ kind: "refused", reason: "not_owner" });
    expect(provider.calls).toHaveLength(0);
  });

  test("FR-INTAKE-01-6: a message held at the dev provider and never delivered is found by catch-up, once", async () => {
    const sqlite = await openSqliteSubject();
    try {
      const dev = new DevProvider({ db: sqlite.db, clock });
      await dev.hold({ chat: "+5491123456789", from: "+5491123456789", text: "held", sentAt: 5_000, providerMessageId: "held-1" });
      const useCase = build({ provider: dev, uow: sqlite.unitOfWork, reads: sqlite.repos, settings: sqlite.settings });
      expect(await useCase.execute({ trigger: "start" })).toMatchObject({ kind: "finished", stored: 1 });
      expect(await useCase.execute({ trigger: "timer" })).toMatchObject({ kind: "finished", stored: 0 });
      const all = await sqlite.repos.messages.listChat(CHAT, {});
      expect(all.map((m) => [m.props.id.providerMessageId, m.props.dev])).toEqual([["held-1", true]]);
    } finally {
      sqlite.cleanup();
    }
  });
});

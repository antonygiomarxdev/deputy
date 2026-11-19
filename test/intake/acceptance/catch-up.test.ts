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
import { OVERLAP_MS } from "../../../src/intake/domain/constants";
import { OwnerNumbers } from "../../../src/intake/domain/owner-numbers";
import { SyncState } from "../../../src/intake/domain/sync-state";
import type { IntakeRepos, IntakeUnitOfWork } from "../../../src/intake/ports/intake-unit-of-work";
import type { IntakeSettingsRepository } from "../../../src/intake/ports/intake-settings-repository";
import { ProviderError, type Provider, type ProviderMessage } from "../../../src/intake/ports/provider";
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
    const failures = new StorageFailureLog();
    const prov = over.provider ?? provider;
    const reads = over.reads ?? store.repos;
    const status = new GetSyncStatusUseCase({
      provider: prov.name,
      reads,
      settings: over.settings ?? new InMemoryIntakeSettingsRepository(),
      coordinator,
      failures,
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
      failures,
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
    const reads = provider.calls.filter((c) => c.kind === "messages" && "conversationRef" in c.scope);
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

  describe("sweep 2, windows and a lost lease", () => {
    const timeout = () => new ProviderError("timeout", null, false);
    const run = (useCase = build()) => useCase.execute({ trigger: "timer" });
    // a run stopped by an error is not mapped to a status yet (SPEC-03 Task 4), so only its saved state is checked
    const runAndStop = (useCase = build()) => useCase.execute({ trigger: "timer" }).catch(() => undefined);
    const outboundCalls = () => provider.calls.filter((c) => c.kind === "messages" && "outbound" in c.scope);

    test("FR-INTAKE-04-4: sweep 2 stores an owner echo that did not move the conversation", async () => {
      provider.serverTime = 10_000;
      provider.hold("c1", "5491123456789", [msg("a", 100)]);
      await run();
      provider.serverTime = 20_000;
      provider.outbound = [echo("echo-1", 15_000)];
      const second = await run();
      expect(second).toMatchObject({ kind: "finished", stored: 1 });
      expect((await store.repos.messages.find({ provider: "kapso", providerMessageId: "echo-1" }))?.props).toMatchObject({
        source: "owner_app",
        history: false,
      });
    });

    test("FR-INTAKE-03-4: a known message does not stop the paging; two earlier ones are stored", async () => {
      provider.serverTime = 10_000;
      await run();
      await store.unitOfWork.run((r) =>
        new StoreMessages({ clock }).store(r, { provider: "kapso", events: [{ kind: "message", message: msg("c", 15_000) }] }),
      );
      provider.serverTime = 20_000;
      provider.pageSize = 1;
      provider.hold("c1", "5491123456789", [msg("a", 12_000), msg("b", 13_000), msg("c", 15_000)]);
      expect(await run()).toMatchObject({ kind: "finished", stored: 2 });
      expect(await rows()).toEqual(["a", "b", "c"]);
    });

    test("FR-INTAKE-03-20: a run stopped after half the conversations resumes from the saved mark", async () => {
      provider.serverTime = 400_000_000;
      provider.hold("c1", "5491123456789", [msg("m1", 100_000_000)]);
      provider.hold("c2", "5491123456789", [msg("m2", 200_000_000)]);
      provider.hold("c3", "5491123456789", [msg("m3", 300_000_000)]);
      let failing = true;
      provider.onCall = (c) => {
        if (failing && c.kind === "messages" && "conversationRef" in c.scope && c.scope.conversationRef === "c2") throw timeout();
      };
      await runAndStop();
      expect((await store.repos.syncState.load("kapso"))?.props.markConversations).toBe(100_000_000);
      expect(await rows()).toEqual(["m1"]);

      failing = false;
      provider.calls.length = 0;
      expect(await run()).toMatchObject({ kind: "finished" });
      expect(provider.calls[0]).toEqual({ kind: "conversations", activeAfter: 100_000_000 - OVERLAP_MS, cursor: null });
      expect(await rows()).toEqual(["m1", "m2", "m3"]);
    });

    describe("sweep 2 stopped after page 1 of 3", () => {
      beforeEach(async () => {
        provider.serverTime = 10_000;
        provider.pageSize = 2;
        provider.outbound = [1, 2, 3, 4, 5].map((n) => echo(`e${n}`, n * 100));
        let outboundSeen = 0;
        provider.onCall = (c) => {
          if (c.kind === "messages" && "outbound" in c.scope && ++outboundSeen === 2) throw timeout();
        };
        await runAndStop();
        provider.onCall = null;
        provider.calls.length = 0;
      });

      test("the saved cursor makes the next run request page 2 first", async () => {
        expect((await store.repos.syncState.load("kapso"))?.props.outboundResume).toMatchObject({ cursor: "2", from: null, runStart: 10_000 });
        provider.serverTime = 20_000; // the provider clock has moved on since the stopped run
        expect(await run()).toMatchObject({ kind: "finished" });
        expect(outboundCalls()[0]).toMatchObject({ cursor: "2" });
        expect(await rows()).toEqual(["e1", "e2", "e3", "e4", "e5"]);
        // the resumed window was opened by the first run, so its mark is that run's start, not this one's
        expect((await store.repos.syncState.load("kapso"))?.props).toMatchObject({ outboundResume: null, markOutbound: 10_000 });
      });

      test("a provider that refuses the cursor makes the window start again, losing and duplicating nothing", async () => {
        let refused = false;
        provider.onCall = (c) => {
          if (!refused && c.kind === "messages" && "outbound" in c.scope && c.cursor === "2") {
            refused = true;
            throw new ProviderError("bad_response", null, false);
          }
        };
        expect(await run()).toMatchObject({ kind: "finished" });
        expect(outboundCalls().map((c) => (c.cursor === null ? null : String(c.cursor)))).toEqual(["2", null, "2", "4"]);
        expect(await rows()).toEqual(["e1", "e2", "e3", "e4", "e5"]);
      });

      test("a bad_response on a later page does not restart the window from the beginning", async () => {
        provider.onCall = (c) => {
          if (c.kind === "messages" && "outbound" in c.scope && c.cursor === "4") throw new ProviderError("bad_response", null, false);
        };
        await runAndStop();
        // a restart would request the first page again (null) and read the same pages once more
        expect(outboundCalls().map((c) => (c.cursor === null ? null : String(c.cursor)))).toEqual(["2", "4"]);
      });
    });

    test("sweep 2 does not stop at a page whose oldest item is exactly at the window start", async () => {
      provider.serverTime = 2_000_000;
      await run(); // markOutbound 2,000,000: the next outbound window starts at 2,000,000 - OVERLAP_MS
      provider.serverTime = 3_000_000;
      provider.pageSize = 2;
      provider.outbound = [
        echo("e1", 2_900_000),
        echo("e2", 2_800_000),
        echo("e3", 2_000_000),
        echo("e4", 2_000_000 - OVERLAP_MS), // exactly the window start: not older, so page 3 is read
        echo("e5", 500_000), // older: this page ends the window
      ];
      provider.calls.length = 0;
      await run();
      expect(outboundCalls().map((c) => (c.cursor === null ? null : String(c.cursor)))).toEqual([null, "2", "4"]);
    });

    test("sweep 2 stops at the page that holds an item older than its window", async () => {
      provider.serverTime = 2_000_000;
      await run(); // markOutbound 2,000,000: the next outbound window starts at 1,400,000
      provider.serverTime = 3_000_000;
      provider.pageSize = 2;
      provider.outbound = [
        echo("e1", 2_900_000),
        echo("e2", 2_800_000),
        echo("e3", 2_000_000),
        echo("e4", 1_000_000), // page 2 holds this item, older than the window: sweep 2 stops here
        echo("e5", 500_000), // page 3: never requested
      ];
      provider.calls.length = 0;
      await run();
      expect(outboundCalls().map((c) => (c.cursor === null ? null : String(c.cursor)))).toEqual([null, "2"]);
      expect(await rows()).toEqual(["e4", "e3", "e2", "e1"]);
    });

    test("a saved outbound cursor of an older window is not reused once the window start has moved", async () => {
      // a stopped run left a cursor for the window that started at the beginning (from null); the mark has moved since
      const old = SyncState.initial("kapso");
      old.completeOutbound(2_000_000);
      old.saveOutboundResume({ cursor: "2", from: null, runStart: 10_000 });
      await store.repos.syncState.save(old);
      provider.serverTime = 3_000_000;
      provider.pageSize = 2;
      provider.outbound = [echo("e1", 2_900_000), echo("e2", 2_800_000), echo("e3", 2_700_000)];
      expect(await run()).toMatchObject({ kind: "finished", stored: 3 });
      // window now starts at 2,000,000 - OVERLAP_MS: the read starts at the newest item, not at the old cursor
      expect(outboundCalls().map((c) => (c.cursor === null ? null : String(c.cursor)))).toEqual([null, "2"]);
      expect((await store.repos.syncState.load("kapso"))?.props.outboundResume).toBeNull();
    });

    test("a provider clock one hour off loses nothing: marks use provider time, order uses sentAt", async () => {
      const skew = 3_600_000;
      provider.serverTime = 1_000_000 + skew;
      provider.hold("c1", "5491123456789", [msg("a", 900_000 + skew)]);
      await run();
      provider.serverTime = 1_060_000 + skew;
      provider.hold("c1", "5491123456789", [msg("a", 900_000 + skew), msg("c", 1_050_000 + skew), msg("b", 1_020_000 + skew)]);
      expect(await run()).toMatchObject({ kind: "finished", stored: 2 });
      expect(await rows()).toEqual(["a", "b", "c"]);
      expect((await store.repos.syncState.load("kapso"))?.props).toMatchObject({ markConversations: 1_060_000 + skew, connectedAt: 1_000_000 + skew });
    });

    test("FR-INTAKE-03-2: after ten days off the run reads from the mark minus the overlap, and day 9 is stored", async () => {
      const d0 = 100 * DAY;
      provider.serverTime = d0;
      provider.hold("c1", "5491123456789", [msg("a", d0 - 1_000)]);
      await run();
      provider.serverTime = d0 + 10 * DAY;
      provider.hold("c1", "5491123456789", [msg("a", d0 - 1_000), msg("day9", d0 + 9 * DAY)]);
      provider.calls.length = 0;
      expect(await run()).toMatchObject({ kind: "finished", stored: 1 });
      expect(provider.calls[0]).toEqual({ kind: "conversations", activeAfter: d0 - OVERLAP_MS, cursor: null });
      expect(await rows()).toEqual(["a", "day9"]);
    });

    test("FR-INTAKE-03-16: a message that arrived live is stored once when a later run lists it", async () => {
      provider.serverTime = 10_000;
      await run();
      await store.unitOfWork.run((r) =>
        new StoreMessages({ clock }).store(r, { provider: "kapso", events: [{ kind: "message", message: msg("live", 15_000) }] }),
      );
      provider.serverTime = 20_000;
      provider.hold("c1", "5491123456789", [msg("live", 15_000)]);
      expect(await run()).toMatchObject({ kind: "finished", stored: 0 });
      expect(await rows()).toEqual(["live"]);
    });

    test("a lost lease stops the run at the next page: no more writes, no finish", async () => {
      store = new InMemoryIntakeStore({ isOwner: async () => isOwner });
      provider.serverTime = 400_000_000;
      provider.hold("c1", "5491123456789", [msg("m1", 100_000_000)]);
      provider.hold("c2", "5491123456789", [msg("m2", 200_000_000)]);
      provider.onCall = (c) => {
        if (c.kind === "messages" && "conversationRef" in c.scope && c.scope.conversationRef === "c2") isOwner = false;
      };
      expect(await run()).toEqual({ kind: "refused", reason: "not_owner" });
      expect(await rows()).toEqual(["m1"]);
      expect(finished()).toHaveLength(0);
      expect((await store.repos.syncState.load("kapso"))?.props).toMatchObject({ lastSuccessAt: null, markConversations: 100_000_000 });
    });
  });
});

import { beforeEach, describe, expect, test } from "bun:test";
import { InMemoryIntakeSettingsRepository } from "../../../src/intake/adapters/memory/in-memory-intake-settings-repository";
import { InMemoryIntakeStore } from "../../../src/intake/adapters/memory/in-memory-intake-store";
import { RecordingEventPublisher } from "../../../src/intake/adapters/memory/recording-event-publisher";
import { CatchUpUseCase, type RunResult } from "../../../src/intake/application/catch-up";
import { GetSyncStatusUseCase } from "../../../src/intake/application/get-sync-status";
import { RunCoordinator } from "../../../src/intake/application/run-coordinator";
import { StorageFailureLog } from "../../../src/intake/application/storage-failure-log";
import { StoreMessages } from "../../../src/intake/application/store-messages";
import { MAX_PAGES, RUN_BUDGET_MS, TELL_OWNER_AFTER_MS } from "../../../src/intake/domain/constants";
import type { IntakeUnitOfWork } from "../../../src/intake/ports/intake-unit-of-work";
import { ProviderError, toCursor, type Page, type ProviderConversation, type ProviderMessage } from "../../../src/intake/ports/provider";
import { parseChatId } from "../../../src/shared/chat-id";
import { FakeClock } from "../../support/fake-clock";
import { FakeProvider } from "../../support/fake-provider";
import { providerMessage } from "../../support/intake-fixtures";

const CHAT = (() => {
  const c = parseChatId("+541123456789");
  if (!c) throw new Error("chat");
  return c;
})();
const msg = (id: string, sentAt: number): ProviderMessage => providerMessage({ providerMessageId: id, sentAt, conversationRef: "c1" });
const fail = (kind: ConstructorParameters<typeof ProviderError>[0], retryAfterMs: number | null = null) => new ProviderError(kind, retryAfterMs, false);

/** A provider whose conversation listing always answers with the same next cursor. */
class LoopingProvider extends FakeProvider {
  override async listConversations(
    q: Parameters<FakeProvider["listConversations"]>[0],
    signal: AbortSignal,
  ): Promise<Page<ProviderConversation>> {
    const page = await super.listConversations(q, signal);
    return { ...page, next: toCursor("loop") };
  }
}

describe("CatchUp failures", () => {
  let store: InMemoryIntakeStore;
  let provider: FakeProvider;
  let clock: FakeClock;
  let publisher: RecordingEventPublisher;
  let failures: StorageFailureLog;

  beforeEach(() => {
    store = new InMemoryIntakeStore();
    provider = new FakeProvider("kapso");
    clock = new FakeClock(1_000_000);
    clock.autoAdvance();
    publisher = new RecordingEventPublisher();
    failures = new StorageFailureLog();
    provider.serverTime = 10_000;
  });

  const build = (over: { provider?: FakeProvider; uow?: IntakeUnitOfWork } = {}) => {
    const coordinator = new RunCoordinator<RunResult>(clock);
    const prov = over.provider ?? provider;
    const status = new GetSyncStatusUseCase({
      provider: prov.name,
      reads: store.repos,
      settings: new InMemoryIntakeSettingsRepository(),
      coordinator,
      failures,
      clock,
    });
    return new CatchUpUseCase({
      provider: prov,
      clock,
      lease: { isOwner: async () => true },
      uow: over.uow ?? store.unitOfWork,
      reads: store.repos,
      store: new StoreMessages({ clock }),
      publisher,
      coordinator,
      status,
      failures,
    });
  };
  const run = async (useCase = build()) => {
    const result = await useCase.execute({ trigger: "timer", waitMs: 300_000 });
    if (result.kind !== "finished") throw new Error(`expected finished, got ${result.kind}`);
    return result.status;
  };
  const rows = async () => (await store.repos.messages.listChat(CHAT, {})).map((m) => m.props.id.providerMessageId);
  const storeDirectly = (...messages: ProviderMessage[]) =>
    store.unitOfWork.run((r) =>
      new StoreMessages({ clock }).store(r, { provider: "kapso", events: messages.map((message) => ({ kind: "message" as const, message })) }),
    );

  test("FR-INTAKE-03-7: unreachable, credentials and quota fail with their own sentence and the newest stored time", async () => {
    await storeDirectly(msg("old", 5_000));
    const sentences = {
      unreachable: "Could not reach Kapso.",
      credentials: "Kapso did not accept the key. Check it where Setup put it.",
      quota: "The Kapso message quota is used up.",
    } as const;
    for (const kind of ["unreachable", "credentials", "quota"] as const) {
      provider.onCall = () => {
        throw fail(kind);
      };
      const status = await run();
      expect(status).toMatchObject({ status: "failed", reason: kind, newestStoredAt: 5_000 });
      expect(status.reasonText.startsWith(sentences[kind])).toBe(true);
      expect(status.reasonText).toContain("The newest message I have is from");
    }
  });

  test("FR-INTAKE-03-8: a run that stored 2 of 5 messages and then failed keeps them and never reads as complete", async () => {
    provider.pageSize = 1;
    provider.hold("c1", "5491123456789", [1, 2, 3, 4, 5].map((n) => msg(`m${n}`, n * 100)));
    let reads = 0;
    provider.onCall = (c) => {
      if (c.kind === "messages" && ++reads === 3) throw fail("unreachable");
    };
    const status = await run();
    expect(status).toMatchObject({ status: "failed", reason: "unreachable" });
    expect(await rows()).toEqual(["m4", "m5"]);
    expect((await build().execute({ trigger: "asked" })).kind).toBe("finished");
    provider.onCall = null;
    expect((await run()).status).toBe("complete");
    expect(await rows()).toEqual(["m1", "m2", "m3", "m4", "m5"]);
  });

  describe("FR-INTAKE-03-14: the caller wait", () => {
    test("a provider that times out after 15 s fails the run with reason timeout, returned by 20 s", async () => {
      provider.onCall = async () => {
        await clock.sleep(15_000);
        throw fail("timeout");
      };
      const started = clock.now();
      const status = await run();
      expect(status).toMatchObject({ status: "failed", reason: "timeout" });
      expect(clock.now() - started).toBeLessThanOrEqual(20_000);
    });

    test("a provider that answers after 25 s: still_running at 20 s, and a later read shows the result", async () => {
      provider.hold("c1", "5491123456789", [msg("a", 100)]);
      provider.onCall = async (c) => {
        if (c.kind === "conversations") await clock.sleep(25_000);
      };
      const useCase = build();
      const started = clock.now();
      const early = await useCase.execute({ trigger: "asked", waitMs: 20_000 });
      expect(early.kind).toBe("still_running");
      expect(clock.now() - started).toBe(20_000);
      const later = await useCase.execute({ trigger: "asked", waitMs: 60_000 });
      expect(later).toMatchObject({ kind: "finished", status: { status: "complete" } });
      expect(await rows()).toEqual(["a"]);
    });
  });

  test("FR-INTAKE-03-20: a 429 keeps messages and marks, sets retryAt, tells nobody at first, tells after 10 minutes, and a complete run clears it", async () => {
    provider.pageSize = 1;
    provider.hold("c1", "5491123456789", [msg("a", 100), msg("b", 200)]);
    provider.hold("c2", "5491123456789", [msg("c", 300)], 300);
    let reads = 0;
    provider.onCall = (c) => {
      if (c.kind === "messages" && ++reads >= 3) throw fail("rate_limited", 30_000);
    };
    const failedAt = clock.now();
    const first = await run();
    expect(first).toMatchObject({ status: "failed", reason: "usage_limit", retryAt: failedAt + 30_000, tellOwner: false });
    expect(await rows()).toEqual(["a", "b"]);
    expect((await store.repos.syncState.load("kapso"))?.props.markConversations).toBe(200);

    await clock.advance(TELL_OWNER_AFTER_MS);
    const later = await run();
    expect(later).toMatchObject({ status: "failed", reason: "usage_limit", tellOwner: true });

    provider.onCall = null;
    expect(await run()).toMatchObject({ status: "complete", reason: null, retryAt: null, tellOwner: false, failedSince: null });
  });

  test("a 429 with no Retry-After waits the default minute", async () => {
    provider.onCall = () => {
      throw fail("rate_limited", null);
    };
    const at = clock.now();
    expect((await run()).retryAt).toBe(at + 60_000);
  });

  describe("FR-INTAKE-03-6: the 60-second budget", () => {
    test("a run that ends on the budget after storing a page is catching_up", async () => {
      provider.pageSize = 1;
      provider.hold("c1", "5491123456789", [msg("a", 100), msg("b", 200)]);
      let reads = 0;
      provider.onCall = async (c) => {
        if (c.kind === "messages" && ++reads === 2) await clock.sleep(RUN_BUDGET_MS + 1_000);
      };
      expect(await run()).toMatchObject({ status: "failed", reason: "catching_up" });
      expect(await rows()).toEqual(["a", "b"]);
    });

    test("a run that ends on the budget with no progress is timeout", async () => {
      provider.hold("c1", "5491123456789", [msg("a", 100)]);
      provider.onCall = async (c) => {
        if (c.kind === "conversations") await clock.sleep(RUN_BUDGET_MS + 1_000);
      };
      expect(await run()).toMatchObject({ status: "failed", reason: "timeout" });
      expect(await rows()).toEqual([]);
    });
  });

  describe("limits: a broken listing stops the run with bad_response", () => {
    test("a listing that repeats a cursor", async () => {
      const looping = new LoopingProvider("kapso");
      looping.serverTime = 10_000;
      looping.hold("c1", "5491123456789", [msg("a", 100)]);
      const status = await run(build({ provider: looping }));
      expect(status).toMatchObject({ status: "failed", reason: "bad_response" });
      // asserted by count, not by a timeout: the guard stops at the second request of the repeated cursor
      expect(looping.calls.filter((c) => c.kind === "conversations")).toHaveLength(2);
    });

    test("a listing that passes MAX_PAGES", async () => {
      provider.pageSize = 1;
      for (let i = 0; i < MAX_PAGES + 5; i++) provider.conversations.push({ ref: `c${i}`, counterpart: null, group: false, lastActiveAt: i });
      const status = await run();
      expect(status).toMatchObject({ status: "failed", reason: "bad_response" });
      expect(provider.calls.filter((c) => c.kind === "conversations")).toHaveLength(MAX_PAGES);
    });
  });

  test("a storage error maps to storage, is logged by time, and publishes the failure", async () => {
    provider.hold("c1", "5491123456789", [msg("a", 100)]);
    let calls = 0;
    const failing: IntakeUnitOfWork = {
      run: (work) => {
        // the connect-time save works, the first page fails, and recording the failure works again
        if (++calls === 2) return Promise.reject(new Error("disk full"));
        return store.unitOfWork.run(work);
      },
    };
    const at = clock.now();
    const status = await run(build({ uow: failing }));
    expect(status).toMatchObject({ status: "failed", reason: "storage", storageFailureAt: at });
    const done = publisher.published.find((e) => e.name === "CatchUpFinished");
    expect(done?.name === "CatchUpFinished" && [done.status, done.reason]).toEqual(["failed", "storage"]);
  });

  test("messages stored before a failure are still announced once", async () => {
    provider.serverTime = 10_000;
    await run();
    provider.serverTime = 20_000;
    provider.pageSize = 1;
    provider.hold("c1", "5491123456789", [msg("n1", 15_000), msg("n2", 16_000)]);
    let reads = 0;
    provider.onCall = (c) => {
      if (c.kind === "messages" && ++reads === 2) throw fail("unreachable");
    };
    publisher.published.length = 0;
    await run();
    const stored = publisher.published.filter((e) => e.name === "MessageStored");
    expect(stored).toHaveLength(1);
    expect(stored[0]?.name === "MessageStored" && stored[0].items).toEqual([{ chat: CHAT, source: "customer", count: 1 }]);
  });
});

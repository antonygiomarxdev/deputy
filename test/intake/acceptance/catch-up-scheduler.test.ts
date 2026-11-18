import { beforeEach, describe, expect, test } from "bun:test";
import { InMemoryIntakeSettingsRepository } from "../../../src/intake/adapters/memory/in-memory-intake-settings-repository";
import { InMemoryIntakeStore } from "../../../src/intake/adapters/memory/in-memory-intake-store";
import { RecordingEventPublisher } from "../../../src/intake/adapters/memory/recording-event-publisher";
import { CatchUpScheduler } from "../../../src/intake/adapters/scheduler/catch-up-scheduler";
import { CatchUpUseCase, type RunResult } from "../../../src/intake/application/catch-up";
import { GetIntakeSettingsUseCase } from "../../../src/intake/application/get-intake-settings";
import { GetSyncStatusUseCase } from "../../../src/intake/application/get-sync-status";
import { RunCoordinator } from "../../../src/intake/application/run-coordinator";
import { StorageFailureLog } from "../../../src/intake/application/storage-failure-log";
import { StoreMessages } from "../../../src/intake/application/store-messages";
import type { CatchUp } from "../../../src/intake/ports/catch-up";
import type { SyncStatusView } from "../../../src/intake/ports/get-sync-status";
import { ProviderError, type ProviderMessage } from "../../../src/intake/ports/provider";
import { parseChatId } from "../../../src/shared/chat-id";
import { FakeClock } from "../../support/fake-clock";
import { FakeProvider } from "../../support/fake-provider";
import { providerMessage } from "../../support/intake-fixtures";

const MIN = 60_000;
const START = 10_000_000;
const CHAT = (() => {
  const c = parseChatId("+541123456789");
  if (!c) throw new Error("chat");
  return c;
})();
const flush = () => new Promise((r) => setTimeout(r, 0));
const msg = (id: string, sentAt: number): ProviderMessage => providerMessage({ providerMessageId: id, sentAt, conversationRef: "c1" });

describe("CatchUpScheduler with the real use case", () => {
  let store: InMemoryIntakeStore;
  let provider: FakeProvider;
  let clock: FakeClock;
  let settings: InMemoryIntakeSettingsRepository;
  let runs: number[];

  beforeEach(() => {
    store = new InMemoryIntakeStore();
    provider = new FakeProvider("kapso");
    clock = new FakeClock(START);
    settings = new InMemoryIntakeSettingsRepository();
    runs = [];
    provider.onCall = (c) => {
      if (c.kind === "conversations" && c.cursor === null) runs.push(clock.now() - START);
    };
  });

  const scheduler = () => {
    const coordinator = new RunCoordinator<RunResult>(clock);
    const failures = new StorageFailureLog();
    const status = new GetSyncStatusUseCase({ provider: "kapso", reads: store.repos, settings, coordinator, failures, clock });
    const catchUp = new CatchUpUseCase({
      provider,
      clock,
      lease: { isOwner: async () => true },
      uow: store.unitOfWork,
      reads: store.repos,
      store: new StoreMessages({ clock }),
      publisher: new RecordingEventPublisher(),
      coordinator,
      status,
      failures,
    });
    return new CatchUpScheduler({ catchUp, settings: new GetIntakeSettingsUseCase(settings), clock });
  };
  const rows = async () => (await store.repos.messages.listChat(CHAT, {})).map((m) => m.props.id.providerMessageId);
  const minutes = async (n: number) => {
    for (let i = 0; i < n; i++) {
      await clock.advance(MIN);
      await flush();
    }
  };

  test("FR-INTAKE-03-10: with the default period it runs at 0, 2, 4, 6, 8 and 10 minutes and stores what arrived without being asked", async () => {
    provider.serverTime = START;
    const s = scheduler();
    s.start();
    await flush();
    await minutes(3);
    provider.serverTime = START + 3 * MIN;
    provider.hold("c1", "5491123456789", [msg("at-3", START + 3 * MIN - 1_000)]);
    await minutes(4);
    provider.serverTime = START + 7 * MIN;
    provider.hold("c1", "5491123456789", [msg("at-3", START + 3 * MIN - 1_000), msg("at-7", START + 7 * MIN - 1_000)]);
    await minutes(3);
    s.stop();
    expect(runs).toEqual([0, 2, 4, 6, 8, 10].map((m) => m * MIN));
    expect(await rows()).toEqual(["at-3", "at-7"]);
  });

  test("FR-INTAKE-03-10: a period changed between runs sets the next wait", async () => {
    const s = scheduler();
    s.start();
    await flush();
    await minutes(1);
    await settings.setCatchUpMinutes(5, clock.now());
    await minutes(9);
    s.stop();
    // the run at 2 reads 5 before it waits: the next run is at 7, not 4
    expect(runs).toEqual([0, 2, 7].map((m) => m * MIN));
  });

  test("FR-INTAKE-03-20: a 429 with a Retry-After of 30 s makes the next run start at retryAt, not at the period", async () => {
    let limited = true;
    provider.onCall = (c) => {
      if (c.kind === "conversations" && c.cursor === null) runs.push(clock.now() - START);
      if (limited) {
        limited = false;
        throw new ProviderError("rate_limited", 30_000, false);
      }
    };
    const s = scheduler();
    s.start();
    await flush();
    await clock.advance(30_000);
    await flush();
    await minutes(2);
    s.stop();
    expect(runs).toEqual([0, 30_000, 30_000 + 2 * MIN]);
  });

  test("stop ends the loop at its next wake", async () => {
    const s = scheduler();
    s.start();
    await flush();
    s.stop();
    await minutes(6);
    expect(runs).toEqual([0]);
  });
});

describe("CatchUpScheduler with scripted results", () => {
  let clock: FakeClock;
  let triggers: string[];
  let times: number[];

  beforeEach(() => {
    clock = new FakeClock(START);
    triggers = [];
    times = [];
  });

  const view = (over: Partial<SyncStatusView> = {}): SyncStatusView => ({
    provider: "kapso",
    status: "complete",
    reason: null,
    reasonText: "",
    running: false,
    lastAttemptAt: null,
    lastSuccessAt: null,
    newestStoredAt: null,
    oldestStoredAt: null,
    failedSince: null,
    retryAt: null,
    tellOwner: false,
    gap: null,
    historyMaybeSyncing: false,
    catchUpMinutes: 2,
    storageFailureAt: null,
    lastLiveDeliveryVerifiedAt: null,
    ...over,
  });
  const scripted = (steps: Array<() => Awaited<ReturnType<CatchUp["execute"]>> | Promise<never>>): CatchUp => ({
    async execute(q) {
      triggers.push(q.trigger);
      times.push(clock.now() - START);
      const step = steps[Math.min(triggers.length - 1, steps.length - 1)];
      if (step === undefined) throw new Error("no step");
      return step();
    },
  });
  const run = async (catchUp: CatchUp, advance: number) => {
    const s = new CatchUpScheduler({ catchUp, settings: new GetIntakeSettingsUseCase(new InMemoryIntakeSettingsRepository()), clock });
    s.start();
    await flush();
    for (let t = 0; t < advance; t += 10_000) {
      await clock.advance(10_000);
      await flush();
    }
    s.stop();
  };
  const finished = (status: SyncStatusView) => () => ({ kind: "finished" as const, status, stored: 0 });

  test("a run that is catching up runs again at once, with trigger retry", async () => {
    await run(
      scripted([finished(view({ status: "failed", reason: "catching_up" })), finished(view({ status: "failed", reason: "catching_up" })), finished(view())]),
      3 * MIN,
    );
    expect(triggers.slice(0, 4)).toEqual(["start", "retry", "retry", "timer"]);
    expect(times.slice(0, 4)).toEqual([0, 0, 0, 2 * MIN]);
  });

  test("a rate limit waits until retryAt and then runs with trigger retry; a retryAt in the past runs at once", async () => {
    await run(scripted([finished(view({ status: "failed", reason: "usage_limit", retryAt: START + 30_000 })), finished(view())]), MIN);
    expect(triggers.slice(0, 2)).toEqual(["start", "retry"]);
    expect(times[1]).toBe(30_000);

    triggers = [];
    times = [];
    clock = new FakeClock(START);
    await run(scripted([finished(view({ status: "failed", reason: "usage_limit", retryAt: START - 5_000 })), finished(view())]), 10_000);
    expect(times.slice(0, 2)).toEqual([0, 0]);
  });

  test("another failure, a refusal or a run still going waits the period", async () => {
    await run(scripted([finished(view({ status: "failed", reason: "credentials" })), () => ({ kind: "refused", reason: "not_owner" }), finished(view())]), 7 * MIN);
    expect(triggers.slice(0, 3)).toEqual(["start", "timer", "timer"]);
    expect(times.slice(0, 3)).toEqual([0, 2 * MIN, 4 * MIN]);
  });

  test("starting twice starts one loop", async () => {
    const catchUp = scripted([finished(view())]);
    const s = new CatchUpScheduler({ catchUp, settings: new GetIntakeSettingsUseCase(new InMemoryIntakeSettingsRepository()), clock });
    s.start();
    s.start();
    await flush();
    await clock.advance(MIN);
    await flush();
    s.stop();
    expect(triggers).toEqual(["start"]);
  });

  test("Resilience: a run that throws is logged and the loop goes on", async () => {
    await run(scripted([() => Promise.reject(new Error("boom")), finished(view())]), 3 * MIN);
    expect(triggers.slice(0, 2)).toEqual(["start", "timer"]);
    expect(times.slice(0, 2)).toEqual([0, 2 * MIN]);
  });
});

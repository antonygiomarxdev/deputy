import { beforeEach, describe, expect, test } from "bun:test";
import { InMemoryIntakeSettingsRepository } from "../../../src/intake/adapters/memory/in-memory-intake-settings-repository";
import { InMemoryIntakeStore } from "../../../src/intake/adapters/memory/in-memory-intake-store";
import { RecordingEventPublisher } from "../../../src/intake/adapters/memory/recording-event-publisher";
import { LibphonenumberParser } from "../../../src/intake/adapters/phone/libphonenumber-parser";
import { CatchUpUseCase, type RunResult } from "../../../src/intake/application/catch-up";
import { GetIntakeSettingsUseCase } from "../../../src/intake/application/get-intake-settings";
import { GetSyncStatusUseCase } from "../../../src/intake/application/get-sync-status";
import { RunCoordinator } from "../../../src/intake/application/run-coordinator";
import { SetIntakeSettingsUseCase } from "../../../src/intake/application/set-intake-settings";
import { StorageFailureLog } from "../../../src/intake/application/storage-failure-log";
import { StoreMessages } from "../../../src/intake/application/store-messages";
import { SyncState } from "../../../src/intake/domain/sync-state";
import { parseOwnerWords } from "../../../src/shared/owner-words";
import { FakeClock } from "../../support/fake-clock";
import { FakeProvider } from "../../support/fake-provider";
import { providerMessage } from "../../support/intake-fixtures";

const HOUR = 3_600_000;
const NOW = 100 * HOUR;
const words = (() => {
  const w = parseOwnerWords("yes, change it");
  if (!w) throw new Error("owner words");
  return w;
})();

describe("GetSyncStatus", () => {
  let store: InMemoryIntakeStore;
  let clock: FakeClock;
  let settings: InMemoryIntakeSettingsRepository;

  beforeEach(() => {
    store = new InMemoryIntakeStore();
    clock = new FakeClock(NOW);
    settings = new InMemoryIntakeSettingsRepository();
  });

  const statusUseCase = (failures = new StorageFailureLog()) =>
    new GetSyncStatusUseCase({ provider: "kapso", reads: store.repos, settings, coordinator: new RunCoordinator(clock), failures, clock });
  const storeOne = (sentAt: number) =>
    store.unitOfWork.run((r) =>
      new StoreMessages({ clock }).store(r, {
        provider: "kapso",
        events: [{ kind: "message", message: providerMessage({ providerMessageId: `m${sentAt}`, sentAt }) }],
      }),
    );

  test("FR-INTAKE-03-6: before any run the view is failed with reason not_yet_run", async () => {
    const view = await statusUseCase().execute();
    expect(view).toMatchObject({
      status: "failed",
      reason: "not_yet_run",
      reasonText: "Deputy has not checked Kapso yet. I have no messages yet.",
      lastAttemptAt: null,
      lastSuccessAt: null,
      tellOwner: false,
      historyMaybeSyncing: false,
      catchUpMinutes: 2,
    });
  });

  test("FR-INTAKE-03-6: six hours after the last success the view says so and carries the newest stored time", async () => {
    await storeOne(NOW - 7 * HOUR);
    const state = SyncState.initial("kapso");
    state.begin({ providerTime: NOW - 6 * HOUR, now: NOW - 6 * HOUR });
    state.complete(NOW - 6 * HOUR);
    await store.repos.syncState.save(state);
    const view = await statusUseCase().execute();
    expect(view).toMatchObject({
      status: "complete",
      reason: null,
      reasonText: "",
      lastSuccessAt: NOW - 6 * HOUR,
      newestStoredAt: NOW - 7 * HOUR,
      oldestStoredAt: NOW - 7 * HOUR,
      historyMaybeSyncing: false,
      tellOwner: false,
    });
  });

  test("a first import of zero messages with nothing stored may still be syncing history", async () => {
    const state = SyncState.initial("kapso");
    state.begin({ providerTime: NOW, now: NOW });
    state.complete(NOW);
    await store.repos.syncState.save(state);
    expect((await statusUseCase().execute()).historyMaybeSyncing).toBe(true);
    await storeOne(NOW - HOUR);
    expect((await statusUseCase().execute()).historyMaybeSyncing).toBe(false);
  });

  test("a first import that stored messages is not 'maybe syncing'", async () => {
    const state = SyncState.initial("kapso");
    state.begin({ providerTime: NOW, now: NOW });
    state.countStored(4);
    state.complete(NOW);
    await store.repos.syncState.save(state);
    expect((await statusUseCase().execute()).historyMaybeSyncing).toBe(false);
  });

  test("a failed run shows its reason text, retry time and the storage failure time", async () => {
    const failures = new StorageFailureLog();
    failures.record(NOW - 5);
    const state = SyncState.initial("kapso");
    state.begin({ providerTime: NOW, now: NOW });
    state.fail("usage_limit", NOW, 30_000);
    await store.repos.syncState.save(state);
    expect(await statusUseCase(failures).execute()).toMatchObject({
      status: "failed",
      reason: "usage_limit",
      reasonText: "Kapso asked me to slow down. I have no messages yet.",
      retryAt: NOW + 30_000,
      failedSince: NOW,
      storageFailureAt: NOW - 5,
    });
  });

  test("FR-INTAKE-02-1: the live check time is the signed delivery's, and a catch-up does not change it", async () => {
    await store.repos.syncState.markLiveVerified("kapso", NOW - 1_000);
    expect((await statusUseCase().execute()).lastLiveDeliveryVerifiedAt).toBe(NOW - 1_000);
    const provider = new FakeProvider("kapso");
    provider.serverTime = NOW;
    const coordinator = new RunCoordinator<RunResult>(clock);
    const failures = new StorageFailureLog();
    const catchUp = new CatchUpUseCase({
      provider,
      clock,
      lease: { isOwner: async () => true },
      uow: store.unitOfWork,
      reads: store.repos,
      store: new StoreMessages({ clock }),
      publisher: new RecordingEventPublisher(),
      coordinator,
      status: new GetSyncStatusUseCase({ provider: "kapso", reads: store.repos, settings, coordinator, failures, clock }),
      failures,
    });
    expect(await catchUp.execute({ trigger: "timer" })).toMatchObject({ kind: "finished", status: { status: "complete" } });
    expect((await statusUseCase().execute()).lastLiveDeliveryVerifiedAt).toBe(NOW - 1_000);
  });

  test("the view reads the period the owner set", async () => {
    await settings.setCatchUpMinutes(7, NOW);
    expect((await statusUseCase().execute()).catchUpMinutes).toBe(7);
  });
});

describe("intake settings", () => {
  let settings: InMemoryIntakeSettingsRepository;
  let isOwner: boolean;

  beforeEach(() => {
    settings = new InMemoryIntakeSettingsRepository();
    isOwner = true;
  });

  const set = () =>
    new SetIntakeSettingsUseCase({ settings, lease: { isOwner: async () => isOwner }, parser: new LibphonenumberParser(), clock: new FakeClock(NOW) });
  const minutes = (value: number) => set().execute({ key: "catch_up_minutes", value, ownerWords: words });
  const country = (value: string) => set().execute({ key: "country", value, ownerWords: words });

  test("FR-INTAKE-03-21: a period below one minute is refused and the period is unchanged", async () => {
    await minutes(5);
    expect(await minutes(0.5)).toEqual({ ok: false, reason: "not_an_integer", minimum: 1, kept: 5 });
    expect(await minutes(0)).toEqual({ ok: false, reason: "below_minimum", minimum: 1, kept: 5 });
    expect(await minutes(-3)).toEqual({ ok: false, reason: "below_minimum", minimum: 1, kept: 5 });
    expect(await settings.getCatchUpMinutes()).toBe(5);
  });

  test("one minute is accepted and shown", async () => {
    expect(await minutes(1)).toEqual({ ok: true, value: 1 });
    expect(await new GetIntakeSettingsUseCase(settings).execute()).toEqual({ catchUpMinutes: 1, country: null });
  });

  test("a refusal keeps the default when nothing was set", async () => {
    expect(await minutes(0)).toMatchObject({ ok: false, kept: 2 });
  });

  test("only the lease holder changes a setting", async () => {
    isOwner = false;
    expect(await minutes(5)).toEqual({ ok: false, reason: "not_owner" });
    expect(await country("US")).toEqual({ ok: false, reason: "not_owner" });
    expect(await settings.getCatchUpMinutes()).toBe(2);
    expect(await settings.getCountry()).toBeNull();
  });

  test("a country is stored and shown; an unknown one is refused and keeps the old value", async () => {
    expect(await country("US")).toEqual({ ok: true, value: "US" });
    expect(await new GetIntakeSettingsUseCase(settings).execute()).toEqual({ catchUpMinutes: 2, country: "US" });
    expect(await country("XX")).toEqual({ ok: false, reason: "unknown_country", kept: "US" });
    expect(await settings.getCountry()).toBe("US");
  });

  test("an unknown country with none set keeps null", async () => {
    expect(await country("XX")).toEqual({ ok: false, reason: "unknown_country", kept: null });
  });

  test("the change time is the clock's, for the period and for the country", async () => {
    await minutes(4);
    expect(settings.changedAt.get("catch_up_minutes")).toBe(NOW);
    await country("US");
    expect(settings.changedAt.get("country")).toBe(NOW);
  });
});

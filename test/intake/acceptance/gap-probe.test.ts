// covers: intake/FRD-03/EX-15
// covers: intake/FRD-03/EX-16
// covers: intake/FRD-03/EX-17
// covers: intake/FRD-03/EX-18
// covers: intake/FRD-03/EX-43
// covers: intake/FRD-03/EX-44
import { beforeEach, describe, expect, test } from "bun:test";
import { RUN_BUDGET_MS } from "../../../src/intake/domain/constants";
import { InMemoryIntakeSettingsRepository } from "../../../src/intake/adapters/memory/in-memory-intake-settings-repository";
import { InMemoryIntakeStore } from "../../../src/intake/adapters/memory/in-memory-intake-store";
import { RecordingEventPublisher } from "../../../src/intake/adapters/memory/recording-event-publisher";
import { CatchUpUseCase, type RunResult } from "../../../src/intake/application/catch-up";
import { GetSyncStatusUseCase } from "../../../src/intake/application/get-sync-status";
import { RunCoordinator } from "../../../src/intake/application/run-coordinator";
import { StorageFailureLog } from "../../../src/intake/application/storage-failure-log";
import { StoreMessages } from "../../../src/intake/application/store-messages";
import { OwnerNumbers } from "../../../src/intake/domain/owner-numbers";
import type { IntakeUnitOfWork } from "../../../src/intake/ports/intake-unit-of-work";
import { ProviderError, type ProviderMessage } from "../../../src/intake/ports/provider";
import { PhoneNumber } from "../../../src/shared/phone-number";
import { FakeClock } from "../../support/fake-clock";
import { FakeProvider } from "../../support/fake-provider";
import { providerMessage } from "../../support/intake-fixtures";

const DAY = 86_400_000;
const NOW = 100 * DAY;
const OWNER = "+5491100000000";
const msg = (id: string, sentAt: number, ref = "c1", counterpart = "5491123456789"): ProviderMessage =>
  providerMessage({ providerMessageId: id, sentAt, conversationRef: ref, counterpart, from: counterpart });
const echo = (id: string, sentAt: number): ProviderMessage =>
  providerMessage({ providerMessageId: id, sentAt, conversationRef: "c1", direction: "outbound", from: OWNER });

describe("the gap probe", () => {
  let store: InMemoryIntakeStore;
  let provider: FakeProvider;
  let clock: FakeClock;
  let publisher: RecordingEventPublisher;

  beforeEach(async () => {
    store = new InMemoryIntakeStore();
    provider = new FakeProvider("kapso");
    clock = new FakeClock(1_000_000);
    publisher = new RecordingEventPublisher();
    provider.serverTime = NOW;
    const owner = PhoneNumber.fromInternational(OWNER);
    if (!owner) throw new Error("owner");
    await store.owners.save(OwnerNumbers.of([{ number: owner, kind: "business", label: "", addedAt: 1 }]), []);
  });

  const build = () => {
    const coordinator = new RunCoordinator<RunResult>(clock);
    const failures = new StorageFailureLog();
    return new CatchUpUseCase({
      provider,
      clock,
      lease: { isOwner: async () => true },
      uow: store.unitOfWork,
      reads: store.repos,
      store: new StoreMessages({ clock }),
      publisher,
      coordinator,
      status: new GetSyncStatusUseCase({
        provider: "kapso",
        reads: store.repos,
        settings: new InMemoryIntakeSettingsRepository(),
        coordinator,
        failures,
        clock,
      }),
      failures,
    });
  };
  const run = async (waitMs?: number) => {
    const result = await build().execute({ trigger: "timer", waitMs });
    if (result.kind !== "finished") throw new Error(`expected finished, got ${result.kind}`);
    return result.status;
  };
  const storeDirectly = (...messages: ProviderMessage[]) =>
    store.unitOfWork.run((r) =>
      new StoreMessages({ clock }).store(r, { provider: "kapso", events: messages.map((message) => ({ kind: "message" as const, message })) }),
    );

  test("FR-INTAKE-03-15: the newest stored message is 10 days old and the exhausted listing starts 3 days ago: possible_gap", async () => {
    await storeDirectly(msg("old", NOW - 10 * DAY));
    provider.hold("c1", "5491123456789", [msg("recent", NOW - 3 * DAY)]);
    const status = await run();
    expect(status).toMatchObject({
      status: "failed",
      reason: "possible_gap",
      gap: { storedAt: NOW - 10 * DAY, returnedAt: NOW - 3 * DAY },
    });
    expect(status.reasonText).toContain("WhatsApp Business app");
    expect(status.reasonText).toContain(new Date(NOW - 10 * DAY).toISOString());
    expect(status.reasonText).toContain(new Date(NOW - 3 * DAY).toISOString());
    const done = publisher.published.find((e) => e.name === "CatchUpFinished");
    expect(done?.name === "CatchUpFinished" && [done.status, done.reason]).toEqual(["failed", "possible_gap"]);
  });

  test("FR-INTAKE-03-13: the provider holds 3 days while 10 are stored: the view exposes how far back Deputy goes", async () => {
    await storeDirectly(msg("old", NOW - 10 * DAY));
    provider.hold("c1", "5491123456789", [msg("recent", NOW - 3 * DAY)]);
    const status = await run();
    expect(status).toMatchObject({ reason: "possible_gap", oldestStoredAt: NOW - 10 * DAY, newestStoredAt: NOW - 3 * DAY });
  });

  test("a quiet shop: nothing new, run after run, is never a gap", async () => {
    provider.hold("c1", "5491123456789", [msg("a", NOW - 3 * DAY), msg("b", NOW - 2 * DAY)]);
    expect(await run()).toMatchObject({ status: "complete", gap: null });
    provider.serverTime = NOW + DAY;
    expect(await run()).toMatchObject({ status: "complete", gap: null });
  });

  test("a new conversation whose listing is exhausted, with nothing older stored, is not a gap", async () => {
    await storeDirectly(msg("other", NOW - 10 * DAY, "c2", "5491100000001"));
    provider.hold("c2", "5491100000001", [msg("other", NOW - 10 * DAY, "c2", "5491100000001")]);
    provider.hold("c1", "5491123456789", [msg("fresh", NOW - 1 * DAY)]);
    expect(await run()).toMatchObject({ status: "complete", gap: null });
  });

  test("the first reply the owner ever sends is not a gap: customer messages are not owner messages", async () => {
    await storeDirectly(msg("c1", NOW - 5 * DAY));
    provider.hold("c1", "5491123456789", [msg("c1", NOW - 5 * DAY)]);
    provider.outbound = [echo("first-reply", NOW - 1 * DAY)];
    expect(await run()).toMatchObject({ status: "complete", gap: null });
  });

  test("an empty exhausted listing (no oldest item) is not a gap, even with older messages stored", async () => {
    await storeDirectly(echo("old-reply", NOW - 10 * DAY));
    provider.outbound = [];
    expect(await run()).toMatchObject({ status: "complete", gap: null });
  });

  test("a listing that stopped at the window (not read to its end) is not a gap", async () => {
    provider.serverTime = 2_000_000;
    await run(); // marks 2,000,000: the next window starts at 1,400,000
    provider.serverTime = 3_000_000;
    provider.pageSize = 2;
    await storeDirectly(msg("ancient", 500_000));
    provider.hold("c1", "5491123456789", [
      msg("n1", 2_900_000),
      msg("n2", 2_800_000),
      msg("mid", 2_000_000),
      msg("old", 1_000_000), // page 2 holds this item, older than the window: the read stops with the listing not exhausted
      msg("never-read", 400_000),
    ]);
    expect(await run()).toMatchObject({ status: "complete", gap: null });
  });

  test("the first gap found is the one reported", async () => {
    await storeDirectly(msg("a-old", NOW - 20 * DAY, "c1", "5491123456789"), msg("b-old", NOW - 9 * DAY, "c2", "5491100000001"));
    provider.hold("c1", "5491123456789", [msg("a-new", NOW - 4 * DAY)]); // less recently active: swept first
    provider.hold("c2", "5491100000001", [msg("b-new", NOW - 2 * DAY, "c2", "5491100000001")]);
    expect((await run()).gap).toEqual({ storedAt: NOW - 20 * DAY, returnedAt: NOW - 4 * DAY });
  });

  test("a gap does not resolve the recoverable rejection notes", async () => {
    await store.unitOfWork.run((r) => r.rejections.add(clock.now() - 10, "no_identifier", true));
    await storeDirectly(msg("old", NOW - 10 * DAY));
    provider.hold("c1", "5491123456789", [msg("recent", NOW - 3 * DAY)]);
    await run();
    expect((await store.repos.rejections.list()).unrecovered).toBe(1);
  });
});

describe("the gap probe on later runs (FR-INTAKE-03-15, SPEC-03 Task 5 (b) to (d))", () => {
  let store: InMemoryIntakeStore;
  let provider: FakeProvider;
  let clock: FakeClock;
  let publisher: RecordingEventPublisher;

  beforeEach(async () => {
    store = new InMemoryIntakeStore();
    provider = new FakeProvider("kapso");
    clock = new FakeClock(1_000_000);
    publisher = new RecordingEventPublisher();
    provider.serverTime = NOW;
    const owner = PhoneNumber.fromInternational(OWNER);
    if (!owner) throw new Error("owner");
    await store.owners.save(OwnerNumbers.of([{ number: owner, kind: "business", label: "", addedAt: 1 }]), []);
  });

  const build = (uow: IntakeUnitOfWork = store.unitOfWork) => {
    const coordinator = new RunCoordinator<RunResult>(clock);
    const failures = new StorageFailureLog();
    return new CatchUpUseCase({
      provider,
      clock,
      lease: { isOwner: async () => true },
      uow,
      reads: store.repos,
      store: new StoreMessages({ clock }),
      publisher,
      coordinator,
      status: new GetSyncStatusUseCase({ provider: "kapso", reads: store.repos, settings: new InMemoryIntakeSettingsRepository(), coordinator, failures, clock }),
      failures,
    });
  };
  const run = async (waitMs?: number) => {
    const result = await build().execute({ trigger: "timer", waitMs });
    if (result.kind !== "finished") throw new Error(`expected finished, got ${result.kind}`);
    return result.status;
  };
  const storeDirectly = (...messages: ProviderMessage[]) =>
    store.unitOfWork.run((r) =>
      new StoreMessages({ clock }).store(r, { provider: "kapso", events: messages.map((message) => ({ kind: "message" as const, message })) }),
    );

  test("(b) two runs over the same stretch: the first reports possible_gap, the second is complete, the stretch is not reported again", async () => {
    await storeDirectly(msg("old", NOW - 10 * DAY));
    provider.hold("c1", "5491123456789", [msg("recent", NOW - 3 * DAY)], NOW);
    expect(await run()).toMatchObject({ status: "failed", reason: "possible_gap" });
    expect(await run()).toMatchObject({ status: "complete", gap: null });
  });

  test("(c) boundary across runs: the mark was saved at O by an earlier run, so the next run finds no gap", async () => {
    await storeDirectly(msg("old", NOW - 10 * DAY));
    provider.serverTime = NOW - 3 * DAY; // an earlier run that read up to 3 days ago
    expect(await run()).toMatchObject({ status: "complete", gap: null });
    provider.serverTime = NOW;
    provider.hold("c1", "5491123456789", [msg("recent", NOW - 3 * DAY)], NOW);
    expect(await run()).toMatchObject({ status: "complete", gap: null });
  });

  test("(d) a new conversation with nothing stored older than its oldest item is never a gap, on the first run or any later one", async () => {
    provider.hold("c2", "5491100000001", [msg("first", NOW - 2 * DAY, "c2", "5491100000001")], NOW);
    expect(await run()).toMatchObject({ status: "complete", gap: null });
    expect(await run()).toMatchObject({ status: "complete", gap: null });
  });

  const day = (n: number) => NOW - n * DAY;
  const C2 = "5491100000001";

  test("rule A (reviewer-1's scenario): c1 is read, the budget stops before c2, and the gap in c2 is still reported on the next run", async () => {
    await storeDirectly(msg("c2-old", day(20), "c2", C2));
    provider.hold("c1", "5491123456789", [msg("c1-new", day(5))], day(5)); // read first: the least recently active
    provider.hold("c2", C2, [msg("c2-a", day(1), "c2", C2), msg("c2-b", day(6), "c2", C2)], day(1));
    provider.afterCall = async (c) => {
      if (c.kind === "messages" && "conversationRef" in c.scope && c.scope.conversationRef === "c1") await clock.advance(RUN_BUDGET_MS);
    };
    expect(await run(3 * RUN_BUDGET_MS)).toMatchObject({ status: "failed", reason: "catching_up" });
    provider.afterCall = null;
    expect(await run()).toMatchObject({
      status: "failed",
      reason: "possible_gap",
      gap: { storedAt: day(20), returnedAt: day(6) },
    });
  });

  test("the outbound mark is read through a whole run: a complete run's mark covers the stretch, so the next run finds no gap", async () => {
    provider.serverTime = day(2);
    expect(await run()).toMatchObject({ status: "complete", gap: null });
    await storeDirectly(echo("old-reply", day(20)));
    provider.serverTime = NOW;
    provider.outbound = [echo("reply", day(2) - 5 * 60_000)]; // inside the window that starts at the mark less OVERLAP_MS
    expect(await run()).toMatchObject({ status: "complete", gap: null });
  });

  test("a resumed outbound sweep (outboundResume set) finishes the run, and reports no gap when nothing older is stored", async () => {
    provider.pageSize = 1;
    provider.outbound = [echo("r1", day(1)), echo("r2", day(2)), echo("r3", day(3))];
    provider.afterCall = async (c) => {
      if (c.kind === "messages" && "outbound" in c.scope && c.cursor === null) await clock.advance(RUN_BUDGET_MS);
    };
    expect(await run(3 * RUN_BUDGET_MS)).toMatchObject({ status: "failed", reason: "catching_up" });
    provider.afterCall = null;
    const saved = (await store.repos.syncState.load("kapso"))?.props.outboundResume;
    expect(saved).not.toBeNull();
    expect(await run()).toMatchObject({ status: "complete", gap: null });
  });

  test("a crashed run does not count as finished: run 2 reads c1 and dies before its failure is saved; run 3 still reports the gap in c2", async () => {
    await storeDirectly(msg("c2-old", day(20), "c2", C2));
    provider.serverTime = day(30);
    expect(await run()).toMatchObject({ status: "complete", gap: null }); // run 1 finished: the marks are day 30
    provider.hold("c1", "5491123456789", [msg("c1-new", day(5))], day(5)); // read first: moves the mark to day 5 and saves it
    provider.hold("c2", C2, [msg("c2-a", day(1), "c2", C2), msg("c2-b", day(6), "c2", C2)], day(1));
    provider.serverTime = NOW;
    // the process dies: the failure of run 2 is never saved, so the state saved mid-run stays as it was
    let dying = false;
    const dyingUow: IntakeUnitOfWork = {
      run: (work) =>
        store.unitOfWork.run((r) =>
          work({
            ...r,
            syncState: {
              ...r.syncState,
              save: (s) => (dying && s.props.reason !== null ? Promise.reject(new Error("the process died")) : r.syncState.save(s)),
            },
          }),
        ),
    };
    provider.onCall = (c) => {
      if (c.kind === "messages" && "conversationRef" in c.scope && c.scope.conversationRef === "c2") {
        dying = true;
        throw new ProviderError("unreachable", null, false);
      }
    };
    await build(dyingUow).execute({ trigger: "timer" });
    provider.onCall = null;
    dying = false;
    expect(await run()).toMatchObject({
      status: "failed",
      reason: "possible_gap",
      gap: { storedAt: day(20), returnedAt: day(6) },
    });
  });
});

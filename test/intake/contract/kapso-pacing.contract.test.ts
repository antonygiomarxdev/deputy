// covers: intake/FRD-03/EX-31
// covers: intake/FRD-03/EX-32
// covers: intake/FRD-03/EX-33
// covers: intake/FRD-03/EX-34
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { InMemoryIntakeSettingsRepository } from "../../../src/intake/adapters/memory/in-memory-intake-settings-repository";
import { InMemoryIntakeStore } from "../../../src/intake/adapters/memory/in-memory-intake-store";
import { RecordingEventPublisher } from "../../../src/intake/adapters/memory/recording-event-publisher";
import { KapsoProvider } from "../../../src/intake/adapters/kapso/kapso-provider";
import { LibphonenumberParser } from "../../../src/intake/adapters/phone/libphonenumber-parser";
import { CatchUpUseCase, type RunResult } from "../../../src/intake/application/catch-up";
import { GetSyncStatusUseCase } from "../../../src/intake/application/get-sync-status";
import { RunCoordinator } from "../../../src/intake/application/run-coordinator";
import { StorageFailureLog } from "../../../src/intake/application/storage-failure-log";
import { StoreMessages } from "../../../src/intake/application/store-messages";
import { Secret } from "../../../src/intake/domain/secret";
import { PhoneNumber } from "../../../src/shared/phone-number";
import { startFakeKapso } from "../../support/fake-kapso-server";
import { FakeClock } from "../../support/fake-clock";

const MIN = 60_000;
// a minute boundary plus 20 s: provider time is the fake clock, so the next boundary is 40 s away
const BASE = 28_000_000 * MIN;
const START = BASE + 20_000;
const abort = new AbortController().signal;

let stops: Array<() => void> = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
});

/** `auto`: time passes by itself while nothing else runs; not with a use case, whose caller wait would race real I/O. */
function setup(perMinute?: number, auto = true) {
  const clock = new FakeClock(START);
  if (auto) clock.autoAdvance();
  const fake = startFakeKapso({ apiKey: "key-1", phoneNumberId: "pn-1", now: () => clock.now(), ...(perMinute === undefined ? {} : { perMinute }) });
  stops.push(() => fake.stop());
  const provider = new KapsoProvider({
    baseUrl: fake.url,
    graphVersion: "v24.0",
    apiKey: new Secret("key-1"),
    phoneNumberId: "pn-1",
    clock,
    parser: new LibphonenumberParser(),
  });
  return { clock, fake, provider };
}

const conversation = (id: string, activeAt: number) => ({
  id,
  phone_number: "+15557654321",
  status: "active",
  last_active_at: new Date(activeAt).toISOString(),
});
const message = (id: string, conv: string, sentAt: number) => ({
  id,
  timestamp: String(Math.floor(sentAt / 1000)),
  type: "text",
  from: "15557654321",
  text: { body: "hello" },
  kapso: { direction: "inbound", whatsapp_conversation_id: conv },
});

describe("FR-INTAKE-03-18: what an idle shop costs", () => {
  let store: InMemoryIntakeStore;
  beforeEach(() => {
    store = new InMemoryIntakeStore();
  });

  const catchUp = (clock: FakeClock, provider: KapsoProvider) => {
    const coordinator = new RunCoordinator<RunResult>(clock);
    const failures = new StorageFailureLog();
    return new CatchUpUseCase({
      provider,
      clock,
      lease: { isOwner: async () => true },
      uow: store.unitOfWork,
      reads: store.repos,
      store: new StoreMessages({ clock }),
      publisher: new RecordingEventPublisher(),
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

  test("a periodic run that finds nothing new makes one listing, one read per conversation active in the last 10 minutes, and one outbound page", async () => {
    const { clock, fake, provider } = setup(undefined, false);
    fake.state.conversations.push(conversation("recent-a", START - 3 * MIN), conversation("recent-b", START - 9 * MIN), conversation("old", START - 5 * 60 * MIN));
    fake.state.messages.push(message("m-a", "recent-a", START - 3 * MIN), message("m-b", "recent-b", START - 9 * MIN), message("m-old", "old", START - 5 * 60 * MIN));
    const useCase = catchUp(clock, provider);
    expect((await useCase.execute({ trigger: "start", waitMs: 600_000 })).kind).toBe("finished");

    await clock.advance(2 * MIN);
    const before = fake.state.requests.length;
    expect((await useCase.execute({ trigger: "timer", waitMs: 600_000 })).kind).toBe("finished");
    const log = fake.state.requests.slice(before);
    expect(log.filter((r) => r.includes("/conversations"))).toHaveLength(1);
    expect(log.filter((r) => r.includes("conversation_id=recent-a"))).toHaveLength(1);
    expect(log.filter((r) => r.includes("conversation_id=recent-b"))).toHaveLength(1);
    expect(log.filter((r) => r.includes("conversation_id=old"))).toHaveLength(0);
    expect(log.filter((r) => r.includes("direction=outbound"))).toHaveLength(1);
    expect(log).toHaveLength(4);
  });

  test("with no recent activity that is two requests", async () => {
    const { clock, fake, provider } = setup(undefined, false);
    fake.state.conversations.push(conversation("old", START - 5 * 60 * MIN));
    fake.state.messages.push(message("m-old", "old", START - 5 * 60 * MIN));
    const useCase = catchUp(clock, provider);
    await useCase.execute({ trigger: "start", waitMs: 600_000 });
    await clock.advance(2 * MIN);
    const before = fake.state.requests.length;
    await useCase.execute({ trigger: "timer", waitMs: 600_000 });
    expect(fake.state.requests.slice(before)).toHaveLength(2);
  });
});

describe("FR-INTAKE-03-19: reads keep a reserve of the minute", () => {
  const read = (provider: KapsoProvider) => provider.listMessages({ scope: { conversationRef: "c1" }, cursor: null, limit: 1 }, abort);

  test("250 reads never reach 0 remaining and never see a 429; the waits end at the next provider minute plus the margin", async () => {
    const { clock, fake, provider } = setup();
    for (let i = 0; i < 250; i++) await read(provider);
    expect(fake.state.rejected).toBe(0);
    expect(Math.max(...fake.state.windows.values())).toBe(91); // 100 minus the reserve of 10, plus the read that saw remaining 9
    // two waits: from 20 s into the first minute (40 s + 1 s margin), then from 1 s into the next (59 s + 1 s margin)
    expect(clock.now() - START).toBe(41_000 + 60_000);
  });

  test("the provider clock keeps moving between responses: time that passed counts against the wait", async () => {
    const { clock, provider } = setup();
    for (let i = 0; i < 91; i++) await read(provider); // the 91st sees remaining 9
    await clock.sleep(15_000); // 15 s pass before the next read
    await read(provider);
    expect(clock.now()).toBe(BASE + MIN + 1_000);
  });

  test("a send skips the pacing, even at remaining 5; the next read waits", async () => {
    const { clock, fake, provider } = setup();
    fake.burn(94);
    await read(provider); // count 95: remaining 5
    const to = PhoneNumber.fromInternational("+15557654321");
    if (!to) throw new Error("number");
    const at = clock.now();
    await provider.sendText({ to, text: "hello" }, abort);
    expect(clock.now()).toBe(at);
    expect(fake.state.sent).toHaveLength(1);
    await read(provider);
    expect(clock.now()).toBe(BASE + MIN + 1_000);
  });

  test("the low remaining is forgotten once the wait is over, even if the read that followed failed", async () => {
    const { clock, fake, provider } = setup();
    fake.burn(94);
    await read(provider); // remaining 5
    fake.force("messages", { status: 500 });
    await expect(read(provider)).rejects.toThrow(); // waits for the next minute, then fails: no answer to learn the new count from
    expect(clock.now()).toBe(BASE + MIN + 1_000);
    delete fake.state.forced["messages"];
    await read(provider);
    expect(clock.now()).toBe(BASE + MIN + 1_000); // it did not wait a second time
  });

  test("a 429 returns at once with the provider's wait and the adapter does not sleep", async () => {
    const { clock, fake, provider } = setup();
    fake.burn(100); // the minute is spent: the next request is refused
    const at = clock.now();
    await expect(read(provider)).rejects.toMatchObject({ kind: "rate_limited", retryAfterMs: 40_000 });
    expect(clock.now()).toBe(at);
    expect(fake.state.rejected).toBe(1);
  });

  test("a read at remaining 10 does not wait (the reserve is below 10)", async () => {
    const { clock, fake, provider } = setup();
    fake.burn(89);
    await read(provider); // count 90: remaining 10
    const at = clock.now();
    await read(provider);
    expect(clock.now()).toBe(at);
    await read(provider); // that one saw remaining 9
    await read(provider);
    expect(clock.now()).toBe(BASE + MIN + 1_000);
  });
});

import { beforeEach, describe, expect, test } from "bun:test";
import { InMemoryIntakeSettingsRepository } from "../../../src/intake/adapters/memory/in-memory-intake-settings-repository";
import { InMemoryIntakeStore } from "../../../src/intake/adapters/memory/in-memory-intake-store";
import { RecordingEventPublisher } from "../../../src/intake/adapters/memory/recording-event-publisher";
import { CatchUpUseCase, type RunResult } from "../../../src/intake/application/catch-up";
import { GetSyncStatusUseCase } from "../../../src/intake/application/get-sync-status";
import { RunCoordinator } from "../../../src/intake/application/run-coordinator";
import { StorageFailureLog } from "../../../src/intake/application/storage-failure-log";
import { StoreMessages } from "../../../src/intake/application/store-messages";
import { OwnerNumbers } from "../../../src/intake/domain/owner-numbers";
import type { ProviderMessage } from "../../../src/intake/ports/provider";
import { parseChatId } from "../../../src/shared/chat-id";
import { PhoneNumber } from "../../../src/shared/phone-number";
import { FakeClock } from "../../support/fake-clock";
import { FakeProvider } from "../../support/fake-provider";
import { providerMessage } from "../../support/intake-fixtures";

const DAY = 86_400_000;
const OWNER = "+5491100000000";
const CHAT = (() => {
  const c = parseChatId("+541123456789");
  if (!c) throw new Error("chat");
  return c;
})();
const msg = (id: string, sentAt: number, over: Partial<ProviderMessage> = {}): ProviderMessage =>
  providerMessage({ providerMessageId: id, sentAt, conversationRef: "c1", ...over });

describe("Intake FRD-03 examples: history is not announced", () => {
  let store: InMemoryIntakeStore;
  let provider: FakeProvider;
  let publisher: RecordingEventPublisher;

  beforeEach(async () => {
    store = new InMemoryIntakeStore();
    provider = new FakeProvider("kapso");
    publisher = new RecordingEventPublisher();
    const owner = PhoneNumber.fromInternational(OWNER);
    if (!owner) throw new Error("owner");
    await store.owners.save(OwnerNumbers.of([{ number: owner, kind: "business", label: "", addedAt: 1 }]), []);
  });

  const catchUp = () => {
    const clock = new FakeClock(1_000_000);
    const coordinator = new RunCoordinator<RunResult>(clock);
    const failures = new StorageFailureLog();
    const status = new GetSyncStatusUseCase({
      provider: provider.name, reads: store.repos, settings: new InMemoryIntakeSettingsRepository(), coordinator, failures, clock,
    });
    return new CatchUpUseCase({
      provider, clock, lease: { isOwner: async () => true }, uow: store.unitOfWork, reads: store.repos,
      store: new StoreMessages({ clock }), publisher, coordinator, status, failures,
    });
  };
  const signals = () => publisher.published.filter((e) => e.name === "MessageStored");
  const history = async (id: string) => (await store.repos.messages.find({ provider: "kapso", providerMessageId: id }))?.props.history;

  test("covers: intake/FRD-03/EX-41 the first catch-up after connecting stores history: the messages are flagged and no message-stored signal is emitted for them", async () => {
    provider.serverTime = 100 * DAY;
    provider.hold("c1", "5491123456789", [msg("old-1", 10 * DAY), msg("old-2", 50 * DAY), msg("flagged", 99 * DAY, { origin: "history_sync" })]);
    expect(await catchUp().execute({ trigger: "start" })).toMatchObject({ kind: "finished", stored: 3 });
    expect([await history("old-1"), await history("old-2"), await history("flagged")]).toEqual([true, true, true]);
    expect(signals()).toHaveLength(0);
  });

  test("covers: intake/FRD-03/EX-42 a catch-up returns history and one new customer message: the group signal counts only the new message", async () => {
    provider.serverTime = 100 * DAY;
    provider.hold("c1", "5491123456789", [msg("old-1", 10 * DAY), msg("old-2", 50 * DAY), msg("fresh", 100 * DAY + 1_000)]);
    await catchUp().execute({ trigger: "start" });
    expect(await history("fresh")).toBe(false);
    expect(signals()).toHaveLength(1);
    const e = signals()[0];
    expect(e?.name === "MessageStored" && e.items).toEqual([{ chat: CHAT, source: "customer", count: 1 }]);
  });
});

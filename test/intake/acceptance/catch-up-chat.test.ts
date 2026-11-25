// covers: intake/FRD-03/EX-13
// covers: intake/FRD-03/EX-14
// covers: intake/FRD-03/EX-23
// covers: intake/FRD-03/EX-24
// covers: intake/FRD-03/EX-35
// covers: intake/FRD-03/EX-36
// covers: drafts/FRD-03/EX-1
// covers: drafts/FRD-03/EX-30
import { beforeEach, describe, expect, test } from "bun:test";
import { InMemoryIntakeSettingsRepository } from "../../../src/intake/adapters/memory/in-memory-intake-settings-repository";
import { InMemoryIntakeStore } from "../../../src/intake/adapters/memory/in-memory-intake-store";
import { RecordingEventPublisher } from "../../../src/intake/adapters/memory/recording-event-publisher";
import { CatchUpChatUseCase } from "../../../src/intake/application/catch-up-chat";
import { CatchUpUseCase, type RunResult } from "../../../src/intake/application/catch-up";
import { GetSyncStatusUseCase } from "../../../src/intake/application/get-sync-status";
import { RunCoordinator } from "../../../src/intake/application/run-coordinator";
import { StorageFailureLog } from "../../../src/intake/application/storage-failure-log";
import { StoreMessages } from "../../../src/intake/application/store-messages";
import { OVERLAP_MS } from "../../../src/intake/domain/constants";
import { OwnerNumbers } from "../../../src/intake/domain/owner-numbers";
import type { EventPublisher } from "../../../src/intake/ports/event-publisher";
import { ProviderError, type ProviderMessage } from "../../../src/intake/ports/provider";
import { parseChatId } from "../../../src/shared/chat-id";
import { PhoneNumber } from "../../../src/shared/phone-number";
import { FakeClock } from "../../support/fake-clock";
import { FakeProvider } from "../../support/fake-provider";
import { providerMessage } from "../../support/intake-fixtures";

const DAY = 86_400_000;
const NOW = 100 * DAY;
const OWNER = "+5491100000000";
const chatId = (s: string) => {
  const c = parseChatId(s);
  if (!c) throw new Error(s);
  return c;
};
const CHAT = chatId("+541123456789");
const msg = (id: string, sentAt: number, ref = "c1"): ProviderMessage => providerMessage({ providerMessageId: id, sentAt, conversationRef: ref });
const echo = (id: string, sentAt: number): ProviderMessage =>
  providerMessage({ providerMessageId: id, sentAt, conversationRef: "c1", direction: "outbound", from: OWNER });

describe("CatchUpChat", () => {
  let store: InMemoryIntakeStore;
  let provider: FakeProvider;
  let clock: FakeClock;
  let publisher: RecordingEventPublisher;
  let coordinator: RunCoordinator<RunResult>;
  let isOwner: boolean;

  beforeEach(async () => {
    store = new InMemoryIntakeStore();
    provider = new FakeProvider("kapso");
    clock = new FakeClock(NOW);
    clock.autoAdvance();
    publisher = new RecordingEventPublisher();
    coordinator = new RunCoordinator<RunResult>(clock);
    isOwner = true;
    provider.serverTime = NOW;
    const owner = PhoneNumber.fromInternational(OWNER);
    if (!owner) throw new Error("owner");
    await store.owners.save(OwnerNumbers.of([{ number: owner, kind: "business", label: "", addedAt: 1 }]), []);
  });

  const chatUseCase = (over: { publisher?: EventPublisher; store?: InMemoryIntakeStore } = {}) =>
    new CatchUpChatUseCase({
      provider,
      clock,
      lease: { isOwner: async () => isOwner },
      uow: (over.store ?? store).unitOfWork,
      reads: (over.store ?? store).repos,
      store: new StoreMessages({ clock }),
      publisher: over.publisher ?? publisher,
      coordinator,
    });
  const catchUp = () => {
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
  const rows = async () => (await store.repos.messages.listChat(CHAT, {})).map((m) => m.props.id.providerMessageId);
  const storedEvents = () => publisher.published.filter((e) => e.name === "MessageStored");
  const syncState = async () => (await store.repos.syncState.load("kapso"))?.props ?? null;

  test("FR-DRAFTS-03-1: it waits for a running catch-up, then stores an owner reply the run missed", async () => {
    provider.hold("c1", "5491123456789", [msg("hello", NOW - 5_000)]);
    let replyAdded = false;
    let reachedOutbound!: () => void;
    const reached = new Promise<void>((resolve) => (reachedOutbound = resolve));
    provider.afterCall = async (c) => {
      // the run has read the outbound listing; the owner replies right after, while the run is still busy
      if (!replyAdded && c.kind === "messages" && "outbound" in c.scope) {
        replyAdded = true;
        provider.outbound.push(echo("reply", NOW - 1_000));
        reachedOutbound();
        await clock.sleep(5_000);
      }
    };
    const run = catchUp().execute({ trigger: "timer", waitMs: 300_000 });
    await reached;
    expect(coordinator.running).toBe(true);
    const runningAtCall: boolean[] = [];
    provider.onCall = () => {
      runningAtCall.push(coordinator.running);
    };
    const result = await chatUseCase().execute({ chat: CHAT, waitMs: 300_000 });
    await run;
    expect(replyAdded).toBe(true);
    expect(result).toMatchObject({ kind: "fresh", newMessages: 1 });
    expect(result.kind === "fresh" && result.state.lastAnswerAt).toBe(NOW - 1_000);
    expect(result.kind === "fresh" && result.state.lastAnswerSource).toBe("owner_app");
    expect((await store.repos.messages.find({ provider: "kapso", providerMessageId: "reply" }))?.props.source).toBe("owner_app");
    // the run was over before this read began: the calls are the run's, then the chat's
    const kinds = provider.calls.map((c) => (c.kind === "conversations" ? "conv" : "outbound" in c.scope ? "out" : "msgs"));
    expect(kinds.slice(-2)).toEqual(["msgs", "out"]);
    // it did not read while the run was going
    expect(runningAtCall).toEqual([false, false]);
  });

  test("FR-INTAKE-03-9: twice with nothing new: no new messages and the sync state is unchanged", async () => {
    provider.hold("c1", "5491123456789", [msg("a", NOW - 5_000)]);
    await catchUp().execute({ trigger: "timer" });
    const before = await syncState();
    const first = await chatUseCase().execute({ chat: CHAT });
    const second = await chatUseCase().execute({ chat: CHAT });
    expect(first).toMatchObject({ kind: "fresh", newMessages: 0 });
    expect(second).toMatchObject({ kind: "fresh", newMessages: 0 });
    expect(await syncState()).toEqual(before);
  });

  test("FR-INTAKE-03-20: a 429 fails at once with usage_limit, no wait and no mark moved", async () => {
    provider.hold("c1", "5491123456789", [msg("a", NOW - 5_000)]);
    await catchUp().execute({ trigger: "timer" });
    const before = await syncState();
    provider.onCall = () => {
      throw new ProviderError("rate_limited", 30_000, false);
    };
    const at = clock.now();
    expect(await chatUseCase().execute({ chat: CHAT })).toEqual({ kind: "failed", reason: "usage_limit" });
    expect(clock.now()).toBe(at);
    expect(await syncState()).toEqual(before);
  });

  test("FR-INTAKE-03-14: a provider slower than waitMs fails with timeout at waitMs", async () => {
    provider.hold("c1", "5491123456789", [msg("a", NOW - 5_000)]);
    await catchUp().execute({ trigger: "timer" });
    provider.onCall = async () => {
      await clock.sleep(25_000);
    };
    const at = clock.now();
    expect(await chatUseCase().execute({ chat: CHAT, waitMs: 20_000 })).toEqual({ kind: "failed", reason: "timeout" });
    expect(clock.now() - at).toBe(20_000);
  });

  test("a run that outlasts waitMs makes the call fail with timeout without starting a read", async () => {
    provider.hold("c1", "5491123456789", [msg("a", NOW - 5_000)]);
    provider.onCall = async (c) => {
      if (c.kind === "conversations") await clock.sleep(40_000);
    };
    const run = catchUp().execute({ trigger: "timer", waitMs: 300_000 });
    await new Promise((r) => setTimeout(r, 0));
    provider.calls.length = 0;
    expect(await chatUseCase().execute({ chat: CHAT, waitMs: 10_000 })).toEqual({ kind: "failed", reason: "timeout" });
    await run;
    await new Promise((r) => setTimeout(r, 0));
    // only the run's own first listing (no activeAfter) ever happened: the chat never went on to look for a conversation
    expect(provider.calls.filter((c) => c.kind === "conversations" && c.activeAfter !== null)).toEqual([]);
  });

  describe("a chat with no stored conversation", () => {
    test("it lists the conversations of the last 24 hours and reads the one of this chat", async () => {
      provider.hold("c-other", "5491100000099", [msg("other", NOW - 3_000, "c-other")]);
      provider.hold("c1", "5491123456789", [msg("a", NOW - 5_000)]);
      const result = await chatUseCase().execute({ chat: CHAT });
      expect(result).toMatchObject({ kind: "fresh", newMessages: 1 });
      expect(provider.calls[0]).toEqual({ kind: "conversations", activeAfter: NOW - DAY, cursor: null });
      const read = provider.calls.filter((c) => c.kind === "messages" && "conversationRef" in c.scope);
      expect(read.map((c) => c.kind === "messages" && "conversationRef" in c.scope && c.scope.conversationRef)).toEqual(["c1"]);
      expect(await rows()).toEqual(["a"]);
    });

    test("with none, only the outbound page is read", async () => {
      provider.hold("c-other", "5491100000099", [msg("other", NOW - 3_000, "c-other")]);
      provider.outbound = [echo("reply", NOW - 1_000)];
      const result = await chatUseCase().execute({ chat: CHAT });
      expect(result).toMatchObject({ kind: "fresh", newMessages: 1 });
      expect(provider.calls.filter((c) => c.kind === "messages").every((c) => c.kind === "messages" && "outbound" in c.scope)).toBe(true);
    });

    test("a group chat is found by its group id", async () => {
      provider.messages.set("cg", [providerMessage({ providerMessageId: "g1-msg", sentAt: NOW - 2_000, conversationRef: "cg", group: true, counterpart: "g1" })]);
      provider.conversations = [{ ref: "cg", counterpart: "g1", group: true, lastActiveAt: NOW - 2_000 }];
      const result = await chatUseCase().execute({ chat: chatId("group:g1") });
      expect(result).toMatchObject({ kind: "fresh", newMessages: 1, state: { chat: "group:g1", mark: "group_chat", conversationRef: "cg" } });
    });

    test("a state-less chat is answered with an empty view", async () => {
      const result = await chatUseCase().execute({ chat: CHAT });
      expect(result.kind === "fresh" && result.state).toMatchObject({
        chat: CHAT,
        mark: "normal",
        lastCustomerAt: null,
        lastAnswerAt: null,
        conversationRef: null,
      });
    });
  });

  test("it reads a conversation newest first and stops at the page holding an item older than the chat's newest minus the overlap", async () => {
    const known = NOW - DAY;
    await store.unitOfWork.run((r) =>
      new StoreMessages({ clock }).store(r, { provider: "kapso", events: [{ kind: "message", message: msg("known", known) }] }),
    );
    provider.pageSize = 2;
    provider.hold("c1", "5491123456789", [
      msg("n1", known + 3_000),
      msg("known", known),
      msg("w1", known - 1_000), // older than the newest stored, but inside the overlap: the read goes on
      msg("w2", known - 2_000),
      msg("older", known - OVERLAP_MS - 5_000), // page 3 holds this: the read stops there
      msg("same-page", known - OVERLAP_MS - 6_000),
      msg("never-read", known - 3 * DAY),
    ]);
    await chatUseCase().execute({ chat: CHAT });
    const reads = provider.calls.filter((c) => c.kind === "messages" && "conversationRef" in c.scope);
    expect(reads.map((c) => (c.kind === "messages" && c.cursor !== null ? String(c.cursor) : null))).toEqual([null, "2", "4"]);
    expect(await rows()).toEqual(["same-page", "older", "w2", "w1", "known", "n1"]);
  });

  test("a chat whose stored messages have no answer or customer time is read to the end", async () => {
    await store.unitOfWork.run((r) =>
      new StoreMessages({ clock }).store(r, {
        provider: "kapso",
        events: [{ kind: "message", message: providerMessage({ providerMessageId: "anon", sentAt: NOW - 9 * DAY, from: null, conversationRef: "c1" }) }],
      }),
    );
    provider.pageSize = 1;
    provider.hold("c1", "5491123456789", [msg("p1", NOW - 3_000), msg("p2", NOW - 2 * DAY), msg("p3", NOW - 5 * DAY)]);
    await chatUseCase().execute({ chat: CHAT });
    expect(await rows()).toEqual(["anon", "p3", "p2", "p1"]);
  });

  test("new non-history messages are announced once as catch_up; none, no event", async () => {
    provider.hold("c1", "5491123456789", [msg("a", NOW - 5_000)]);
    await catchUp().execute({ trigger: "timer" });
    publisher.published.length = 0;
    expect(await chatUseCase().execute({ chat: CHAT })).toMatchObject({ newMessages: 0 });
    expect(publisher.published).toEqual([]);

    provider.outbound = [echo("reply", NOW + 1_000)];
    provider.serverTime = NOW + 2_000;
    await chatUseCase().execute({ chat: CHAT });
    expect(storedEvents()).toHaveLength(1);
    const e = storedEvents()[0];
    expect(e?.name === "MessageStored" && [e.origin, e.items]).toEqual(["catch_up", [{ chat: CHAT, source: "owner_app", count: 1 }]]);
  });

  test("an owner reply with no sender is stored as unattributed and announced once as OwnerReplyUnlinked", async () => {
    provider.hold("c1", "5491123456789", [msg("a", NOW - 5_000)]);
    await catchUp().execute({ trigger: "timer" });
    publisher.published.length = 0;
    provider.outbound = [providerMessage({ providerMessageId: "unlinked", direction: "outbound", from: null, sentAt: NOW + 1_000, conversationRef: "c1" })];
    provider.serverTime = NOW + 2_000;
    const result = await chatUseCase().execute({ chat: CHAT });
    expect(result).toMatchObject({ kind: "fresh", newMessages: 1 });
    expect((await store.repos.messages.find({ provider: "kapso", providerMessageId: "unlinked" }))?.props.mark).toBe("not_attributable");
    expect(publisher.published.filter((e) => e.name === "OwnerReplyUnlinked")).toHaveLength(1);
    expect(storedEvents()).toHaveLength(1);
    await chatUseCase().execute({ chat: CHAT });
    expect(publisher.published.filter((e) => e.name === "OwnerReplyUnlinked")).toHaveLength(1);
  });

  test("a subscriber that throws does not fail the read", async () => {
    provider.hold("c1", "5491123456789", [msg("a", NOW - 5_000)]);
    const throwing: EventPublisher = {
      publish() {
        throw new Error("subscriber bug");
      },
    };
    expect(await chatUseCase({ publisher: throwing }).execute({ chat: CHAT })).toMatchObject({ kind: "fresh" });
  });

  test("not the owner: refused, and the provider is never called", async () => {
    isOwner = false;
    expect(await chatUseCase().execute({ chat: CHAT })).toEqual({ kind: "refused", reason: "not_owner" });
    expect(provider.calls).toEqual([]);
  });

  test("a lease lost between the read and the store is refused, a bad answer is unreachable, a storage error is storage", async () => {
    provider.hold("c1", "5491123456789", [msg("a", NOW - 5_000)]);
    const lost = new InMemoryIntakeStore({ isOwner: async () => false });
    expect(await chatUseCase({ store: lost }).execute({ chat: CHAT })).toEqual({ kind: "refused", reason: "not_owner" });

    provider.onCall = () => {
      throw new ProviderError("bad_response", null, false);
    };
    expect(await chatUseCase().execute({ chat: CHAT })).toEqual({ kind: "failed", reason: "unreachable" });

    provider.onCall = () => {
      throw new ProviderError("credentials", null, false);
    };
    expect(await chatUseCase().execute({ chat: CHAT })).toEqual({ kind: "failed", reason: "credentials" });

    provider.onCall = null;
    const broken = new InMemoryIntakeStore();
    broken.unitOfWork.run = () => Promise.reject(new Error("disk full"));
    expect(await chatUseCase({ store: broken }).execute({ chat: CHAT })).toEqual({ kind: "failed", reason: "storage" });
  });
});

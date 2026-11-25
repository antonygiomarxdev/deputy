import { beforeEach, describe, expect, test } from "bun:test";
import { InMemoryIntakeStore } from "../../../src/intake/adapters/memory/in-memory-intake-store";
import { ChatExistsUseCase } from "../../../src/intake/application/chat-exists";
import { GetMessagesUseCase } from "../../../src/intake/application/get-messages";
import { IsCustomerTextUseCase } from "../../../src/intake/application/is-customer-text";
import { ListChatsUseCase } from "../../../src/intake/application/list-chats";
import { ListRejectionsUseCase } from "../../../src/intake/application/list-rejections";
import { ReadChatUseCase } from "../../../src/intake/application/read-chat";
import { StoreMessages } from "../../../src/intake/application/store-messages";
import { OwnerNumbers } from "../../../src/intake/domain/owner-numbers";
import type { ProviderEvent, ProviderMessage } from "../../../src/intake/ports/provider";
import { lineChatId, UNATTRIBUTED_CHAT, type ChatId } from "../../../src/shared/chat-id";
import { PhoneNumber } from "../../../src/shared/phone-number";
import type { ProviderName } from "../../../src/shared/provider-name";
import type { SendId } from "../../../src/shared/send-id";
import { FakeClock } from "../../support/fake-clock";
import { providerMessage } from "../../support/intake-fixtures";

const CUSTOMER = "5491123456789";
const OTHER = "5215512345678";
const OWNER = "5491100000001";
const phone = (raw: string): PhoneNumber => {
  const n = PhoneNumber.fromInternational(raw);
  if (n === null) throw new Error(raw);
  return n;
};
const chat = lineChatId(phone(CUSTOMER));
const otherChat = lineChatId(phone(OTHER));
const kapsoId = (providerMessageId: string) => ({ provider: "kapso" as const, providerMessageId });
const msg = (over: Partial<ProviderMessage>): ProviderEvent => ({ kind: "message", message: providerMessage(over) });

let store: InMemoryIntakeStore;
let clock: FakeClock;
let service: StoreMessages;

beforeEach(async () => {
  store = new InMemoryIntakeStore();
  clock = new FakeClock(1_000);
  service = new StoreMessages({ clock });
  const owners = OwnerNumbers.empty();
  owners.add({ number: phone(OWNER), kind: "business", label: "", addedAt: 1 });
  await store.repos.owners.save(owners, []);
});

/** Stores the events as if they arrived at local time `at`. */
async function arrive(events: ProviderEvent[], at: number, provider: ProviderName = "kapso") {
  await clock.advance(at - clock.now());
  return store.unitOfWork.run((r) => service.store(r, { provider, events }));
}
const readChat = () => new ReadChatUseCase(store.repos);
const listChats = (provider: ProviderName = "kapso") => new ListChatsUseCase({ repos: store.repos, provider });

describe("read use cases", () => {
  // covers: intake/FRD-02/EX-3
  // covers: intake/FRD-02/EX-5
  // covers: intake/FRD-02/EX-6
  test("FR-INTAKE-02-3: ListRejections shows time and reason only; the no-id note stays unrecovered until resolved", async () => {
    await arrive([msg({ providerMessageId: null })], 2_000);
    const list = new ListRejectionsUseCase(store.repos);
    const first = await list.execute();
    expect(first.notes).toEqual([{ at: 2_000, reason: "no_identifier", recoverable: true, resolved: false }]);
    expect(first.unrecovered).toBe(1);
    await store.repos.rejections.resolveRecoverableBefore(3_000, 4_000);
    const second = await list.execute();
    expect(second.unrecovered).toBe(0);
    expect(second.notes[0]?.resolved).toBe(true);
  });

  test("FR-INTAKE-02-4: GetMessages returns the known ids with chat and source and nothing for the unknown one", async () => {
    await arrive(
      [
        msg({ providerMessageId: "a", sentAt: 100 }),
        msg({ providerMessageId: "b", direction: "outbound", from: OWNER, counterpart: CUSTOMER, sentAt: 200 }),
        msg({ providerMessageId: "c", from: OTHER, counterpart: OTHER, sentAt: 300 }),
      ],
      2_000,
    );
    const views = await new GetMessagesUseCase(store.repos).execute({ ids: [kapsoId("a"), kapsoId("c"), kapsoId("nope")] });
    expect(views.map((v) => [v.id.providerMessageId, v.chat, v.source])).toEqual([
      ["a", chat, "customer"],
      ["c", otherChat, "customer"],
    ]);
  });

  test("FR-INTAKE-02-6: a voice note reads as its transcript", async () => {
    await arrive([msg({ providerMessageId: "v1", type: "audio", text: null, transcript: "do you deliver?" })], 2_000);
    const view = await readChat().execute({ chat });
    expect(view?.messages[0]).toMatchObject({ type: "audio", readerText: "voice note, transcript: do you deliver?", readable: false });
  });

  describe("FR-INTAKE-02-8: sent order", () => {
    test("reversed arrival is put in sent order and ties keep arrival order", async () => {
      await arrive([msg({ providerMessageId: "late", sentAt: 2_000 })], 3_000);
      await arrive([msg({ providerMessageId: "early", sentAt: 1_000 })], 3_100);
      await arrive([msg({ providerMessageId: "tie1", sentAt: 5_000 }), msg({ providerMessageId: "tie2", sentAt: 5_000 })], 3_200);
      const view = await readChat().execute({ chat });
      expect(view?.messages.map((m) => m.id.providerMessageId)).toEqual(["early", "late", "tie1", "tie2"]);
    });

    test("with a limit, a late echo with an old sentAt is still returned through storedSince", async () => {
      await arrive([msg({ providerMessageId: "m1", sentAt: 10_000 }), msg({ providerMessageId: "m2", sentAt: 11_000 }), msg({ providerMessageId: "m3", sentAt: 12_000 })], 13_000);
      await arrive([msg({ providerMessageId: "echo", direction: "outbound", from: OWNER, counterpart: CUSTOMER, sentAt: 500 })], 50_000);
      const view = await readChat().execute({ chat, limit: 2, storedSince: 50_000 });
      expect(view?.messages.map((m) => m.id.providerMessageId)).toEqual(["echo", "m2", "m3"]);
    });
  });

  describe("FR-INTAKE-02-10: ListChats", () => {
    test("carries the profile name of the newest customer message, and filters by customerMessageSince", async () => {
      await arrive([msg({ providerMessageId: "a", profileName: "Ana", sentAt: 1_500 })], 2_000);
      await arrive([msg({ providerMessageId: "b", from: OTHER, counterpart: OTHER, sentAt: 800 })], 2_100);
      const all = await listChats().execute({});
      expect(all.find((c) => c.chat === chat)?.profileName).toBe("Ana");
      expect(all.find((c) => c.chat === otherChat)?.profileName).toBeUndefined();
      const recent = await listChats().execute({ customerMessageSince: 1_000 });
      expect(recent.map((c) => c.chat)).toEqual([chat]);
    });

    test("under Kapso a chat with only dev messages is absent", async () => {
      await arrive([msg({ providerMessageId: "d1" })], 2_000, "dev");
      expect(await listChats("kapso").execute({})).toEqual([]);
      expect((await listChats("dev").execute({})).map((c) => c.chat)).toEqual([chat]);
    });
  });

  describe("FR-INTAKE-02-13: unattributed echoes", () => {
    test("an echo with no counterpart is read from the unattributed chat with its mark", async () => {
      await arrive([msg({ providerMessageId: "x1", direction: "outbound", from: null, counterpart: null, sentAt: 1_500 })], 2_000);
      const view = await readChat().execute({ chat: UNATTRIBUTED_CHAT });
      expect(view?.mark).toBe("not_attributable");
      expect(view?.messages[0]?.mark).toBe("not_attributable");
    });

    test("every ChatStateView carries unattributedStoredAt, and the owner's own chat shows the echo as the last answer", async () => {
      await arrive([msg({ providerMessageId: "c1", sentAt: 1_100 })], 1_500);
      await arrive([msg({ providerMessageId: "x1", direction: "outbound", from: null, counterpart: CUSTOMER, sentAt: 1_800 })], 2_000);
      const [view] = await listChats().execute({});
      expect(view).toMatchObject({ chat, unattributedStoredAt: 2_000, lastAnswerSource: "owner_app", lastAnswerAt: 1_800 });
    });

    test("the later of the unattributed echo and a real answer wins, with its source", async () => {
      await arrive([msg({ providerMessageId: "c1", sentAt: 1_100 })], 1_500);
      await arrive([msg({ providerMessageId: "o1", direction: "outbound", from: OWNER, counterpart: CUSTOMER, sentAt: 2_000 })], 2_100);
      await arrive([msg({ providerMessageId: "x1", direction: "outbound", from: null, counterpart: CUSTOMER, sentAt: 2_500 })], 2_600);
      const [later] = await listChats().execute({});
      expect(later).toMatchObject({ lastAnswerAt: 2_500, lastAnswerSource: "owner_app", lastUnattributedAt: 2_500 });

      store.addOutgoingPart("kapso", "s1", "send-1" as SendId, 1);
      await arrive([msg({ providerMessageId: "s1", direction: "outbound", from: null, counterpart: CUSTOMER, sentAt: 3_000 })], 3_100);
      const [newer] = await listChats().execute({});
      expect(newer).toMatchObject({ lastAnswerAt: 3_000, lastAnswerSource: "sent_through_deputy" });
    });

    test("TP-02 extra: an echo stored after a draft has a later unattributedStoredAt than the draft's mark", async () => {
      const draftMark = 1_500;
      await arrive([msg({ providerMessageId: "c1", sentAt: 1_100 })], draftMark);
      await arrive([msg({ providerMessageId: "x1", direction: "outbound", from: null, counterpart: null, sentAt: 100 })], 2_000);
      const [view] = await listChats().execute({});
      expect(view?.unattributedStoredAt).toBeGreaterThan(draftMark);
      expect((await readChat().execute({ chat: UNATTRIBUTED_CHAT }))?.messages[0]?.mark).toBe("not_attributable");
    });
  });

  test("FR-INTAKE-01-10: ChatExists tells the dev-only chat apart and the active world", async () => {
    await arrive([msg({ providerMessageId: "d1" })], 2_000, "dev");
    const kapso = await new ChatExistsUseCase({ repos: store.repos, provider: "kapso" }).execute({ chat });
    expect(kapso).toEqual({ exists: true, hasNonDevMessage: false, activeWorldIsDev: false });
    const dev = await new ChatExistsUseCase({ repos: store.repos, provider: "dev" }).execute({ chat });
    expect(dev.activeWorldIsDev).toBe(true);
    expect((await new ChatExistsUseCase({ repos: store.repos, provider: "kapso" }).execute({ chat: "nobody" as ChatId })).exists).toBe(false);
  });

  describe("FR-INTAKE-02-10: IsCustomerText", () => {
    test.each([
      ["¡Hola, Ana!", "hola, ana"],
      ["¿Cuánto cuesta?", "cuánto cuesta"],
      ["أريد ٣ كيلو", "أريد 3 كيلو"],
      ["！！好的，我要３个。。", "好的,我要3个"],
      ["ok 👍", "ok"],
    ])("a stored customer message %s matches %s", async (stored, probe) => {
      await arrive([msg({ providerMessageId: "c1", text: stored })], 2_000);
      const u = new IsCustomerTextUseCase(store.repos);
      expect(await u.execute({ text: probe })).toEqual({ matches: true });
    });

    test("a text only an owner message holds does not match", async () => {
      await arrive([msg({ providerMessageId: "o1", direction: "outbound", from: OWNER, counterpart: CUSTOMER, text: "Only the owner said this" })], 2_000);
      expect(await new IsCustomerTextUseCase(store.repos).execute({ text: "only the owner said this" })).toEqual({ matches: false });
    });

    test("text that normalizes to nothing never matches", async () => {
      await arrive([msg({ providerMessageId: "c1", text: "👍" })], 2_000);
      expect(await new IsCustomerTextUseCase(store.repos).execute({ text: "!!!" })).toEqual({ matches: false });
    });
  });

  test("ReadChat of a chat with no message is null", async () => {
    expect(await readChat().execute({ chat: "nobody" as ChatId })).toBeNull();
    await arrive([msg({ providerMessageId: "c1" })], 2_000);
    expect(await readChat().execute({ chat: otherChat })).toBeNull();
  });

  // covers: intake/FRD-02/EX-19
  test("FR-INTAKE-02-12: an edited message shows edited and its earlier text", async () => {
    await arrive([msg({ providerMessageId: "m1", text: "first" })], 2_000);
    await arrive([{ kind: "edit", providerMessageId: "m1", text: "second" }], 3_000);
    const view = await readChat().execute({ chat });
    expect(view?.messages[0]).toMatchObject({ text: "second", edited: true, previousTexts: ["first"] });
  });
});

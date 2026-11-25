// covers: drafts/FRD-01/EX-1
// covers: drafts/FRD-01/EX-2
// covers: drafts/FRD-01/EX-5
// covers: drafts/FRD-01/EX-6
// covers: drafts/FRD-01/EX-17
// covers: drafts/FRD-01/EX-18
import { describe, expect, test } from "bun:test";
import { IntakeChatReader } from "../../../src/drafts/adapters/intake/intake-chat-reader";
import type { ChatExists, ReadChat } from "../../../src/intake/index";
import type { ChatId } from "../../../src/shared/chat-id";

type ChatView = NonNullable<Awaited<ReturnType<ReadChat["execute"]>>>;
type View = ChatView["messages"][number];

const chat = "chat-a" as ChatId;

function view(id: string, source: View["source"], readerText: string, sentAt: number, over: Partial<View> = {}): View {
  return {
    id: { provider: "kapso", providerMessageId: id },
    chat, sender: null, type: "text", readable: true, text: readerText, transcript: null, readerText,
    sentAt, storedAt: sentAt + 5, source, history: false, dev: false, edited: false, previousTexts: [],
    deletedBySender: false, mark: "normal", ...over,
  };
}

function reader(o: { exists?: boolean; hasNonDevMessage?: boolean; activeWorldIsDev?: boolean; messages?: View[] | null }) {
  const chatExists: ChatExists = {
    execute: async () => ({ exists: o.exists ?? true, hasNonDevMessage: o.hasNonDevMessage ?? true, activeWorldIsDev: o.activeWorldIsDev ?? false }),
  };
  const readChat: ReadChat = {
    execute: async () => (o.messages === null ? null : { chat, mark: "normal", messages: o.messages ?? [] }),
  };
  return new IntakeChatReader({ chatExists, readChat });
}

describe("describe", () => {
  test("FR-DRAFTS-01-1: ChatExists false gives null", async () => {
    expect(await reader({ exists: false }).describe(chat)).toBeNull();
  });

  test("FR-DRAFTS-01-1: a chat with no readable messages gives null", async () => {
    expect(await reader({ messages: null }).describe(chat)).toBeNull();
  });

  test("FR-DRAFTS-01-1: it combines ChatExists and ReadChat into the latest customer message and the latest message", async () => {
    const info = await reader({
      messages: [
        view("m1", "customer", "How much?", 100),
        view("m2", "sent_through_deputy", "10", 200),
        view("m3", "customer", "And the delivery?", 300),
        view("m4", "owner_app", "free", 400),
      ],
    }).describe(chat);
    expect(info?.hasCustomerMessage).toBe(true);
    expect(info?.latestCustomer).toMatchObject({ id: { providerMessageId: "m3" }, text: "And the delivery?", sentAt: 300, storedAt: 305, source: "customer" });
    expect(info?.latest).toMatchObject({ id: { providerMessageId: "m4" }, source: "owner_app" });
  });

  test("FR-DRAFTS-01-1: no customer message gives hasCustomerMessage false and latestCustomer null", async () => {
    const info = await reader({ messages: [view("m1", "owner_app", "hi", 100)] }).describe(chat);
    expect(info).toMatchObject({ hasCustomerMessage: false, latestCustomer: null });
    expect(info?.latest?.id.providerMessageId).toBe("m1");
  });

  test.each([false, true])("FR-DRAFTS-01-8: with activeWorldIsDev %p, latest and latestCustomer come from the active world only", async (activeWorldIsDev) => {
    const info = await reader({
      activeWorldIsDev,
      messages: [
        view("real", "customer", "real question", 100, { dev: false }),
        view("test", "customer", "test question", 300, { dev: true }),
      ],
    }).describe(chat);
    const expected = activeWorldIsDev ? "test" : "real";
    expect(info?.latest?.id.providerMessageId).toBe(expected);
    expect(info?.latestCustomer?.id.providerMessageId).toBe(expected);
  });

  test("FR-DRAFTS-01-8: a chat whose only customer messages are in the other world has no customer message", async () => {
    const info = await reader({ activeWorldIsDev: false, messages: [view("test", "customer", "x", 300, { dev: true })] }).describe(chat);
    expect(info).toMatchObject({ hasCustomerMessage: false, latestCustomer: null, latest: null });
  });

  test.each([true, false])("FR-DRAFTS-01-8: activeWorldIsDev %p and hasNonDevMessage pass through", async (dev) => {
    const info = await reader({ activeWorldIsDev: dev, hasNonDevMessage: !dev, messages: [view("m1", "customer", "x", 1, { dev })] }).describe(chat);
    expect(info).toMatchObject({ activeWorldIsDev: dev, hasNonDevMessage: !dev });
    expect(info?.latest).toMatchObject({ dev, history: false });
  });
});

describe("message", () => {
  test("FR-DRAFTS-01-3: an id Intake has gives the ChatMessage with text equal to readerText; an id it lacks gives null", async () => {
    const r = reader({ messages: [view("m1", "customer", "reader text", 100, { text: "raw", readerText: "reader text" })] });
    expect(await r.message(chat, { provider: "kapso", providerMessageId: "m1" })).toMatchObject({ text: "reader text", source: "customer" });
    expect(await r.message(chat, { provider: "kapso", providerMessageId: "nope" })).toBeNull();
    expect(await r.message(chat, { provider: "dev", providerMessageId: "m1" })).toBeNull();
    expect(await reader({ messages: null }).message(chat, { provider: "kapso", providerMessageId: "m1" })).toBeNull();
  });
});

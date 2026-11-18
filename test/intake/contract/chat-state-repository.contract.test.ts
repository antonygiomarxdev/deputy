import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { parseChatId, type ChatId } from "../../../src/shared/chat-id";
import { receive } from "../../support/intake-fixtures";
import { subjects, type IntakeSubject } from "../../support/intake-subjects";

const CHAT: ChatId = (() => {
  const c = parseChatId("+541123456789");
  if (!c) throw new Error("chat");
  return c;
})();
const seen = { providerId: "5491123456789", conversationRef: "conv-1" };

for (const subject of subjects) {
  describe(`ChatStateRepository (${subject.name})`, () => {
    let s: IntakeSubject;
    beforeEach(async () => {
      s = await subject.open();
    });
    afterEach(() => s.cleanup());

    const add = (over: Parameters<typeof receive>[0], ctx: Parameters<typeof receive>[1] = {}) =>
      s.repos.messages.insertIfNew(receive(over, ctx));

    test("FR-INTAKE-02-9: last customer and last answer", async () => {
      const { OwnerNumbers } = await import("../../../src/intake/domain/owner-numbers");
      const { PhoneNumber } = await import("../../../src/shared/phone-number");
      const owner = PhoneNumber.fromInternational("+5491100000000");
      if (!owner) throw new Error("owner");
      const owners = OwnerNumbers.of([{ number: owner, kind: "business", label: "", addedAt: 1 }]);
      await add({ providerMessageId: "c1", sentAt: 100 });
      await add({ providerMessageId: "o1", sentAt: 200, direction: "outbound", from: "+5491100000000" }, { owners });
      await add({ providerMessageId: "c2", sentAt: 300 });
      await s.repos.chats.recompute(CHAT, false, 9_000, seen);
      expect(await s.repos.chats.get(CHAT, false)).toMatchObject({
        lastCustomerAt: 300,
        lastAnswerAt: 200,
        lastAnswerSource: "owner_app",
        updatedAt: 9_000,
        mark: "normal",
      });
    });

    test("a sender_unknown customer message does not count as the last customer", async () => {
      await add({ providerMessageId: "c1", sentAt: 100 });
      await add({ providerMessageId: "c2", sentAt: 400, from: null });
      await s.repos.chats.recompute(CHAT, false, 1, seen);
      expect((await s.repos.chats.get(CHAT, false))?.lastCustomerAt).toBe(100);
    });

    test("recompute twice gives the same row; providerId stays the first seen; the profile name is kept", async () => {
      await add({});
      await s.repos.chats.recompute(CHAT, false, 1, seen);
      await s.repos.chats.setProfileName(CHAT, false, "Ana", 10);
      const first = await s.repos.chats.get(CHAT, false);
      await s.repos.chats.recompute(CHAT, false, 1, { providerId: "541123456789", conversationRef: null });
      const second = await s.repos.chats.get(CHAT, false);
      expect(second).toEqual(first);
      expect(second).toMatchObject({ providerId: "5491123456789", conversationRef: "conv-1", profileName: "Ana" });
    });

    test("a not attributable message sets lastUnattributedAt", async () => {
      await add({ providerMessageId: "u", sentAt: 250, direction: "outbound", from: null });
      await s.repos.chats.recompute(CHAT, false, 1, seen);
      expect((await s.repos.chats.get(CHAT, false))?.lastUnattributedAt).toBe(250);
    });

    test("list never returns the other world, and filters by customer message time", async () => {
      await add({ providerMessageId: "r", sentAt: 100 });
      await add({ providerMessageId: "d", sentAt: 100 }, { provider: "dev" });
      await s.repos.chats.recompute(CHAT, false, 1, seen);
      await s.repos.chats.recompute(CHAT, true, 1, seen);
      expect((await s.repos.chats.list({ dev: false })).map((c) => c.dev)).toEqual([false]);
      expect((await s.repos.chats.list({ dev: true })).map((c) => c.dev)).toEqual([true]);
      expect(await s.repos.chats.list({ dev: false, customerMessageSince: 101 })).toHaveLength(0);
      expect(await s.repos.chats.list({ dev: false, customerMessageSince: 100 })).toHaveLength(1);
    });
  });
}

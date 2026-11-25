import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { parseChatId, type ChatId } from "../../../src/shared/chat-id";
import { parseSendId } from "../../../src/shared/send-id";
import { OwnerNumbers } from "../../../src/intake/domain/owner-numbers";
import { PhoneNumber } from "../../../src/shared/phone-number";
import { receive } from "../../support/intake-fixtures";

async function ownersWith(number: string): Promise<OwnerNumbers> {
  const n = PhoneNumber.fromInternational(number);
  if (!n) throw new Error(number);
  return OwnerNumbers.of([{ number: n, kind: "business", label: "", addedAt: 1 }]);
}
import { subjects, type IntakeSubject } from "../../support/intake-subjects";

const chat = (s: string): ChatId => {
  const c = parseChatId(s);
  if (!c) throw new Error(s);
  return c;
};

for (const subject of subjects) {
  describe(`MessageRepository (${subject.name})`, () => {
    let s: IntakeSubject;
    beforeEach(async () => {
      s = await subject.open();
    });
    afterEach(() => s.cleanup());

    // covers: intake/FRD-02/EX-7
    test("FR-INTAKE-02-4: find returns every field and the versions", async () => {
      const m = receive({ providerMessageId: "a", text: "old", profileName: "Ana", origin: "cloud_api" });
      await s.repos.messages.insertIfNew(m);
      const edit = m.applyEdit("new", 7_000);
      await s.repos.messages.saveEdit(m.props.id, edit, "new");
      const back = await s.repos.messages.find(m.props.id);
      expect(back?.props).toEqual(m.props);
      expect(back?.versions).toEqual(m.versions);
      expect(back?.textNorm).toBe("new");
      expect(await s.repos.messages.find({ provider: "kapso", providerMessageId: "nope" })).toBeNull();
    });

    test("FR-INTAKE-02-7: a repeated id is a duplicate and the first text stays; providers are separate", async () => {
      expect(await s.repos.messages.insertIfNew(receive({ text: "first" }))).toBe("stored");
      expect(await s.repos.messages.insertIfNew(receive({ text: "second" }))).toBe("duplicate");
      expect((await s.repos.messages.find({ provider: "kapso", providerMessageId: "m1" }))?.props.text).toBe("first");
      expect(await s.repos.messages.insertIfNew(receive({ text: "dev copy" }, { provider: "dev" }))).toBe("stored");
      const both = await s.repos.messages.findMany([
        { provider: "kapso", providerMessageId: "m1" },
        { provider: "dev", providerMessageId: "m1" },
        { provider: "kapso", providerMessageId: "unknown" },
      ]);
      expect(both).toHaveLength(2);
    });

    // covers: intake/FRD-02/EX-16
    test("FR-INTAKE-02-8: sent order is (sentAt, arrival)", async () => {
      await s.repos.messages.insertIfNew(receive({ providerMessageId: "late", sentAt: 300 }));
      await s.repos.messages.insertIfNew(receive({ providerMessageId: "early", sentAt: 100 }));
      await s.repos.messages.insertIfNew(receive({ providerMessageId: "tie-1", sentAt: 200 }));
      await s.repos.messages.insertIfNew(receive({ providerMessageId: "tie-2", sentAt: 200 }));
      const all = await s.repos.messages.listChat(chat("+541123456789"), {});
      expect(all.map((m) => m.props.id.providerMessageId)).toEqual(["early", "tie-1", "tie-2", "late"]);
    });

    test("limit keeps the newest two by sent order plus a late arrival stored since", async () => {
      const c = chat("+541123456789");
      for (const [id, sentAt, now] of [["a", 10, 100], ["b", 20, 100], ["c", 30, 100]] as const) {
        await s.repos.messages.insertIfNew(receive({ providerMessageId: id, sentAt }, { now }));
      }
      await s.repos.messages.insertIfNew(receive({ providerMessageId: "old-late", sentAt: 5 }, { now: 900 }));
      const result = await s.repos.messages.listChat(c, { limit: 2, storedSince: 500 });
      expect(result.map((m) => m.props.id.providerMessageId)).toEqual(["old-late", "b", "c"]);
      const plain = await s.repos.messages.listChat(c, { limit: 2 });
      expect(plain.map((m) => m.props.id.providerMessageId)).toEqual(["b", "c"]);
    });

    test("FR-INTAKE-01-10: chatExists tells dev-only chats apart", async () => {
      const c = chat("+541123456789");
      expect(await s.repos.messages.chatExists(c)).toEqual({ exists: false, hasNonDevMessage: false });
      await s.repos.messages.insertIfNew(receive({}, { provider: "dev" }));
      expect(await s.repos.messages.chatExists(c)).toEqual({ exists: true, hasNonDevMessage: false });
      await s.repos.messages.insertIfNew(receive({ providerMessageId: "real" }));
      expect(await s.repos.messages.chatExists(c)).toEqual({ exists: true, hasNonDevMessage: true });
    });

    test("FR-INTAKE-02-10: hasCustomerTextNorm matches customer text only", async () => {
      await s.repos.messages.insertIfNew(receive({ text: "¡Hola, Ana!" }));
      expect(await s.repos.messages.hasCustomerTextNorm("hola, ana")).toBe(true);
      await s.repos.messages.insertIfNew(
        receive({ providerMessageId: "o", text: "Only the owner", direction: "outbound", devOwnerMark: true }, { provider: "dev" }),
      );
      expect(await s.repos.messages.hasCustomerTextNorm("only the owner")).toBe(false);
    });

    test("newestUnattributedStoredAt is per world", async () => {
      await s.repos.messages.insertIfNew(
        receive({ providerMessageId: "u", direction: "outbound", from: null, counterpart: null }, { now: 5_000 }),
      );
      expect(await s.repos.messages.newestUnattributedStoredAt(false)).toBe(5_000);
      expect(await s.repos.messages.newestUnattributedStoredAt(true)).toBeNull();
    });

    test("markDeleted sets the flag", async () => {
      const m = receive();
      await s.repos.messages.insertIfNew(m);
      await s.repos.messages.markDeleted(m.props.id);
      expect((await s.repos.messages.find(m.props.id))?.props.deletedBySender).toBe(true);
    });

    test("FR-INTAKE-03-13: the gap queries look under the provider, ignoring the dev world", async () => {
      const DAY = 86_400_000;
      const NOW = 100 * DAY;
      const ownerReply = receive(
        { providerMessageId: "owner", direction: "outbound", from: "+5491100000000", sentAt: NOW - 10 * DAY, conversationRef: "c1" },
        { owners: await ownersWith("+5491100000000") },
      );
      await s.repos.messages.insertIfNew(ownerReply);
      await s.repos.messages.insertIfNew(receive({ providerMessageId: "cust", sentAt: NOW - 3 * DAY, conversationRef: "c1" }));
      await s.repos.messages.insertIfNew(receive({ providerMessageId: "dev", sentAt: NOW - 50 * DAY }, { provider: "dev" }));

      expect(await s.repos.messages.newestStoredBefore("kapso", { ownerOrDeputy: true }, NOW - 3 * DAY)).toBe(NOW - 10 * DAY);
      expect(await s.repos.messages.newestStoredBefore("kapso", { ownerOrDeputy: true }, NOW - 10 * DAY)).toBeNull();
      expect(await s.repos.messages.newestStoredBefore("kapso", { conversationRef: "c1" }, NOW)).toBe(NOW - 3 * DAY);
      expect(await s.repos.messages.newestStoredBefore("kapso", { conversationRef: "other" }, NOW)).toBeNull();
      expect(await s.repos.messages.newestStoredAt("kapso")).toBe(NOW - 3 * DAY);
      expect(await s.repos.messages.oldestStoredAt("kapso")).toBe(NOW - 10 * DAY);
      expect(await s.repos.messages.oldestStoredAt("dev")).toBe(NOW - 50 * DAY);
      expect(await s.repos.messages.newestStoredAt("kapso")).not.toBe(NOW - 50 * DAY);
    });

    test("ownerOrDeputy covers owner_app and sent_through_deputy, and nothing else", async () => {
      await s.repos.messages.insertIfNew(receive({ providerMessageId: "cust", sentAt: 300 }));
      await s.repos.messages.insertIfNew(receive({ providerMessageId: "mine", sentAt: 200, direction: "outbound", from: "+5491100000000" }, { owners: await ownersWith("+5491100000000") }));
      await s.repos.messages.insertIfNew(receive({ providerMessageId: "deputy", sentAt: 250, direction: "outbound", from: null }, { matchesSend: true }));
      expect((await s.repos.messages.find({ provider: "kapso", providerMessageId: "deputy" }))?.props.source).toBe("sent_through_deputy");
      expect(await s.repos.messages.newestStoredBefore("kapso", { ownerOrDeputy: true }, 1_000)).toBe(250);
      expect(await s.repos.messages.newestStoredBefore("kapso", { ownerOrDeputy: true }, 250)).toBe(200);
      expect(await s.repos.messages.newestStoredBefore("kapso", { ownerOrDeputy: true }, 200)).toBeNull();
    });

    describe("FR-INTAKE-04-13: source changes", () => {
      const sendId = parseSendId("send-1");
      if (!sendId) throw new Error("send id");
      const owners = ownersWith("+5491100000000");
      const ownerMessage = async (providerMessageId = "echo") =>
        receive({ providerMessageId, direction: "outbound", from: "+5491100000000", sentAt: 500 }, { owners: await owners });

      test("reclassify makes an owner_app message sent_through_deputy and writes one source_changes row", async () => {
        const m = await ownerMessage();
        expect(m.props.source).toBe("owner_app");
        await s.repos.messages.insertIfNew(m);
        const change = m.reclassifyAsDeputySend(sendId, 9_000);
        if (!change.ok) throw new Error("not owner_app");
        const stored = await s.repos.messages.find(m.props.id);
        expect(stored?.props.source).toBe("owner_app");
        await s.repos.messages.reclassify(m.props.id, change.change);
        expect((await s.repos.messages.find(m.props.id))?.props.source).toBe("sent_through_deputy");
        expect(await s.sourceChanges()).toEqual([
          { at: 9_000, provider: "kapso", providerMessageId: "echo", from: "owner_app", to: "sent_through_deputy", sendId },
        ]);
      });

      test("a failure in the second write leaves the source unchanged", async () => {
        const m = await ownerMessage();
        await s.repos.messages.insertIfNew(m);
        const change = m.reclassifyAsDeputySend(sendId, Number.NaN); // no time: the second insert fails
        if (!change.ok) throw new Error("not owner_app");
        await expect(s.repos.messages.reclassify(m.props.id, change.change)).rejects.toThrow();
        expect((await s.repos.messages.find(m.props.id))?.props.source).toBe("owner_app");
        expect(await s.sourceChanges()).toEqual([]);
      });

      test("a message that is not owner_app, or is reclassified twice, leaves no false audit row", async () => {
        const change = (providerMessageId: string, at: number) => ({
          at,
          id: { provider: "kapso" as const, providerMessageId },
          from: "owner_app" as const,
          to: "sent_through_deputy" as const,
          sendId,
        });
        await s.repos.messages.insertIfNew(receive({ providerMessageId: "cust" }));
        await s.repos.messages.reclassify({ provider: "kapso", providerMessageId: "cust" }, change("cust", 1_000));
        expect((await s.repos.messages.find({ provider: "kapso", providerMessageId: "cust" }))?.props.source).toBe("customer");
        expect(await s.sourceChanges()).toEqual([]);

        const m = await ownerMessage("twice");
        await s.repos.messages.insertIfNew(m);
        await s.repos.messages.reclassify(m.props.id, change("twice", 2_000));
        await s.repos.messages.reclassify(m.props.id, change("twice", 3_000));
        await s.repos.messages.reclassify({ provider: "kapso", providerMessageId: "unknown-id" }, change("unknown-id", 4_000));
        expect((await s.sourceChanges()).map((c) => [c.providerMessageId, c.at])).toEqual([["twice", 2_000]]);
      });

      test("a customer message is never reclassified", async () => {
        const m = receive({ providerMessageId: "cust" });
        await s.repos.messages.insertIfNew(m);
        expect(m.reclassifyAsDeputySend(sendId, 9_000)).toEqual({ ok: false, reason: "not_owner_app" });
      });
    });

    test("FR-INTAKE-04-13: countCustomerMessages counts non-dev customer messages of the chat only", async () => {
      const c = chat("+541123456789");
      await s.repos.messages.insertIfNew(receive({ providerMessageId: "c1" }));
      await s.repos.messages.insertIfNew(receive({ providerMessageId: "c2" }));
      await s.repos.messages.insertIfNew(receive({ providerMessageId: "dev1" }, { provider: "dev" }));
      await s.repos.messages.insertIfNew(receive({ providerMessageId: "mine", direction: "outbound", from: "+5491100000000" }, { owners: await ownersWith("+5491100000000") }));
      await s.repos.messages.insertIfNew(receive({ providerMessageId: "other", counterpart: "5215512345678", from: "5215512345678" }));
      expect(await s.repos.messages.countCustomerMessages(c)).toBe(2);
      expect(await s.repos.messages.countCustomerMessages(chat("+19990000000"))).toBe(0);
    });

    test("outgoing: findByProviderId finds a part by its provider id", async () => {
      const sendId = parseSendId("send-1");
      if (!sendId) throw new Error("send id");
      expect(await s.repos.outgoing.findByProviderId("kapso", "wamid.1")).toBeNull();
      await s.addOutgoingPart("kapso", "wamid.1", sendId, 2);
      expect(await s.repos.outgoing.findByProviderId("kapso", "wamid.1")).toEqual({ sendId, part: 2 });
      expect(await s.repos.outgoing.findByProviderId("dev", "wamid.1")).toBeNull();
    });
  });
}

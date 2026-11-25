import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { MAX_PART } from "../../../src/intake/domain/constants";
import { OutgoingSend } from "../../../src/intake/domain/outgoing-send";
import type { ChatId } from "../../../src/shared/chat-id";
import { parseSendId, type SendId } from "../../../src/shared/send-id";
import { receive } from "../../support/intake-fixtures";
import { subjects, type IntakeSubject } from "../../support/intake-subjects";

const chat = "+541123456789" as ChatId;
const sendId = (s: string): SendId => {
  const id = parseSendId(s);
  if (id === null) throw new Error(s);
  return id;
};
const twoParts = (id = "s1") => OutgoingSend.create({ sendId: sendId(id), chat, text: "a".repeat(MAX_PART + 5), createdAt: 100 });

for (const subject of subjects) {
  describe(`OutgoingRepository (${subject.name})`, () => {
    let s: IntakeSubject;
    beforeEach(async () => {
      s = await subject.open();
    });
    afterEach(() => s.cleanup());

    test("FR-INTAKE-04-13: insert, savePart, find and findByProviderId", async () => {
      const send = twoParts();
      await s.repos.outgoing.insert(send);
      send.partSent(1, "w1");
      await s.repos.outgoing.savePart(send, 1, "kapso");
      expect((await s.repos.outgoing.find(send.props.sendId))?.props).toEqual(send.props);
      expect(await s.repos.outgoing.findByProviderId("kapso", "w1")).toEqual({ sendId: send.props.sendId, part: 1 });
      expect(await s.repos.outgoing.findByProviderId("dev", "w1")).toBeNull();
      expect(await s.repos.outgoing.find(sendId("nope"))).toBeNull();
    });

    test("saveSend keeps the state, the failure reason and the finish time", async () => {
      const send = twoParts();
      await s.repos.outgoing.insert(send);
      expect((await s.repos.outgoing.find(send.props.sendId))?.props.retryAt).toBeNull();
      send.failNothingAccepted("rate_limited", 700, 40_700);
      await s.repos.outgoing.saveSend(send);
      expect((await s.repos.outgoing.find(send.props.sendId))?.props).toMatchObject({
        state: "failed",
        failureReason: "rate_limited",
        finishedAt: 700,
        retryAt: 40_700,
      });
    });

    test("the same provider id in two parts is refused", async () => {
      const send = twoParts();
      await s.repos.outgoing.insert(send);
      send.partSent(1, "w1");
      send.partSent(2, "w1");
      await s.repos.outgoing.savePart(send, 1, "kapso");
      await expect(s.repos.outgoing.savePart(send, 2, "kapso")).rejects.toThrow();
    });

    test("a send id is inserted once", async () => {
      await s.repos.outgoing.insert(twoParts());
      await expect(s.repos.outgoing.insert(twoParts())).rejects.toThrow();
    });

    test("markPendingAsUnknown turns a pending send and its pending parts into unknown and counts sends", async () => {
      const pending = twoParts("pending");
      await s.repos.outgoing.insert(pending);
      const done = twoParts("done");
      await s.repos.outgoing.insert(done);
      done.failNothingAccepted("quota", 300);
      await s.repos.outgoing.saveSend(done);
      for (const i of [1, 2]) await s.repos.outgoing.savePart(done, i, "kapso");

      expect(await s.repos.outgoing.markPendingAsUnknown()).toBe(1);
      const back = await s.repos.outgoing.find(sendId("pending"));
      expect(back?.props.state).toBe("unknown");
      expect(back?.props.parts.map((p) => p.state)).toEqual(["unknown", "unknown"]);
      expect((await s.repos.outgoing.find(sendId("done")))?.props.state).toBe("failed");
      expect(await s.repos.outgoing.markPendingAsUnknown()).toBe(0);
    });

    test("FR-INTAKE-04-13: candidatesForPart returns only the unlinked owner_app message with that text at or after since", async () => {
      const owners = await (async () => {
        const { OwnerNumbers } = await import("../../../src/intake/domain/owner-numbers");
        const { PhoneNumber } = await import("../../../src/shared/phone-number");
        const n = PhoneNumber.fromInternational("+5491100000000");
        if (n === null) throw new Error("number");
        return OwnerNumbers.of([{ number: n, kind: "business", label: "", addedAt: 1 }]);
      })();
      const echo = (providerMessageId: string, sentAt: number, over: Parameters<typeof receive>[0] = {}) =>
        receive({ providerMessageId, direction: "outbound", from: "+5491100000000", text: "Hello", sentAt, ...over }, { owners });
      await s.repos.messages.insertIfNew(echo("old", 100));
      await s.repos.messages.insertIfNew(echo("fresh", 5_000));
      await s.repos.messages.insertIfNew(receive({ providerMessageId: "cust", text: "Hello", sentAt: 5_000 }));
      await s.repos.messages.insertIfNew(echo("other-text", 5_000, { text: "Hello!" }));
      await s.repos.messages.insertIfNew(echo("linked", 5_000));
      const send = OutgoingSend.create({ sendId: sendId("s9"), chat, text: "Hello", createdAt: 100 });
      await s.repos.outgoing.insert(send);
      send.partSent(1, "linked");
      await s.repos.outgoing.savePart(send, 1, "kapso");

      expect(await s.repos.outgoing.candidatesForPart(chat, "Hello", 1_000)).toEqual([{ provider: "kapso", providerMessageId: "fresh" }]);
      expect(await s.repos.outgoing.candidatesForPart(chat, "Hello", 5_001)).toEqual([]);
    });
  });
}

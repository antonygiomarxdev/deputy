import { describe, expect, test } from "bun:test";
import { MAX_PART } from "../../../src/intake/domain/constants";
import { OutgoingSend } from "../../../src/intake/domain/outgoing-send";
import type { ChatId } from "../../../src/shared/chat-id";
import type { SendId } from "../../../src/shared/send-id";

const chat = "+15557654321" as ChatId;
const send = (text = "a".repeat(MAX_PART * 3 - 10)) => OutgoingSend.create({ sendId: "s1" as SendId, chat, text, createdAt: 100 });
const states = (s: OutgoingSend) => s.props.parts.map((p) => p.state);

describe("OutgoingSend", () => {
  test("a new send has every part pending, numbered from 1", () => {
    const s = send();
    expect(s.props.state).toBe("pending");
    expect(states(s)).toEqual(["pending", "pending", "pending"]);
    expect(s.props.parts.map((p) => p.index)).toEqual([1, 2, 3]);
    expect(s.props.parts.map((p) => p.text).join("")).toBe(s.props.text);
  });

  test("every part sent and markAllSentIfComplete make the send sent", () => {
    const s = send();
    s.partSent(1, "w1");
    s.markAllSentIfComplete(200);
    expect(s.props.state).toBe("pending");
    s.partSent(2, "w2");
    s.partSent(3, "w3");
    s.markAllSentIfComplete(300);
    expect(s.props).toMatchObject({ state: "sent", finishedAt: 300 });
    expect(s.props.parts.map((p) => p.providerMessageId)).toEqual(["w1", "w2", "w3"]);
  });

  test("a part cannot be sent without an id", () => {
    expect(() => send().partSent(1, "")).toThrow(RangeError);
    expect(() => send().partSent(9, "w")).toThrow(RangeError);
  });

  test("an interruption at part 2 that may have been accepted: send unknown, part 1 sent, part 2 unknown, part 3 failed", () => {
    const s = send();
    s.partSent(1, "w1");
    s.interrupt({ index: 2, mayHaveBeenAccepted: true, at: 400 });
    expect(s.props.state).toBe("unknown");
    expect(states(s)).toEqual(["sent", "unknown", "failed"]);
    expect(s.props.finishedAt).toBe(400);
  });

  test("an interruption that was surely not accepted fails that part", () => {
    const s = send();
    s.partSent(1, "w1");
    s.interrupt({ index: 2, mayHaveBeenAccepted: false, at: 400 });
    expect(states(s)).toEqual(["sent", "failed", "failed"]);
  });

  test("failNothingAccepted fails the send and every part", () => {
    const s = send();
    s.failNothingAccepted("quota", 500);
    expect(s.props).toMatchObject({ state: "failed", failureReason: "quota", finishedAt: 500 });
    expect(states(s)).toEqual(["failed", "failed", "failed"]);
  });

  describe("linkPart", () => {
    test("links an unknown part of an unknown send, and the send becomes sent when every part is", () => {
      const s = send("hello");
      s.interrupt({ index: 1, mayHaveBeenAccepted: true, at: 400 });
      s.linkPart(1, "w1", 600);
      expect(s.props).toMatchObject({ state: "sent", finishedAt: 600 });
      expect(s.props.parts[0]).toMatchObject({ providerMessageId: "w1", state: "sent" });
    });

    test("a part linked while others are not leaves the send unknown", () => {
      const s = send();
      s.interrupt({ index: 1, mayHaveBeenAccepted: true, at: 400 });
      s.linkPart(1, "w1", 600);
      expect(s.props.state).toBe("unknown");
      expect(states(s)).toEqual(["sent", "failed", "failed"]);
    });

    test("is refused on a sent or a failed send, and on a part that is not unknown", () => {
      const sent = send("hello");
      sent.partSent(1, "w1");
      sent.markAllSentIfComplete(300);
      const before = JSON.stringify(sent.props);
      sent.linkPart(1, "other", 400);
      expect(JSON.stringify(sent.props)).toBe(before);

      const failed = send("hello");
      failed.failNothingAccepted("credentials", 300);
      const failedBefore = JSON.stringify(failed.props);
      failed.linkPart(1, "w1", 400);
      expect(JSON.stringify(failed.props)).toBe(failedBefore);

      const unknown = send();
      unknown.interrupt({ index: 1, mayHaveBeenAccepted: true, at: 400 });
      const unknownBefore = JSON.stringify(unknown.props);
      unknown.linkPart(2, "w2", 500); // part 2 is failed, not unknown
      expect(JSON.stringify(unknown.props)).toBe(unknownBefore);
    });

    test("the send state gates it by itself: a pending send with an unknown part (rehydrated) refuses", () => {
      const base = send("hello").props;
      const odd = OutgoingSend.rehydrate({ ...base, state: "pending", parts: base.parts.map((p) => ({ ...p, state: "unknown" })) });
      odd.linkPart(1, "w1", 600);
      expect(odd.props.state).toBe("pending");
      expect(odd.props.parts[0]?.providerMessageId).toBeNull();
    });
  });

  test("markPendingUnknown turns the send and its pending parts into unknown, and keeps a sent part", () => {
    const s = send();
    s.partSent(1, "w1");
    s.markPendingUnknown();
    expect(s.props.state).toBe("unknown");
    expect(states(s)).toEqual(["sent", "unknown", "unknown"]);
  });

  test("a send never goes back to pending", () => {
    const s = send("hello");
    s.failNothingAccepted("rejected", 300);
    s.markPendingUnknown();
    s.markAllSentIfComplete(400);
    expect(s.props.state).toBe("failed");
  });
});

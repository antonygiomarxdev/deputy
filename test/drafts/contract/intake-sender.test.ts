// covers: drafts/FRD-02/EX-10
// covers: drafts/FRD-02/EX-11
import { describe, expect, test } from "bun:test";
import { IntakeSender } from "../../../src/drafts/adapters/intake/intake-sender";
import type { SendText, SendTextResult } from "../../../src/intake/index";
import type { ChatId } from "../../../src/shared/chat-id";

const chat = "chat-a" as ChatId;

function sender(answer: SendTextResult, seen: unknown[] = []) {
  const sendText: SendText = {
    execute: async (q) => {
      seen.push(q);
      return answer;
    },
  };
  return new IntakeSender({ sendText });
}

describe("FR-DRAFTS-02-5: IntakeSender maps SendText one to one", () => {
  test("sent keeps no ids; the call carries the send id, the chat and the text", async () => {
    const seen: unknown[] = [];
    expect(await sender({ kind: "sent", providerMessageIds: ["w1", "w2"] }, seen).send(chat, "hello", "deputy:ap1")).toEqual({ kind: "sent" });
    expect(seen).toEqual([{ sendId: "deputy:ap1", chat, text: "hello" }]);
  });

  test.each([
    [{ kind: "failed", reason: "quota" }],
    [{ kind: "rate_limited", retryAt: 9_000 }],
    [{ kind: "unknown", partsSent: 1, partsTotal: 3 }],
    [{ kind: "refused", reason: "not_owner" }],
  ] as const)("%p comes back with the same kind and fields", async (answer) => {
    expect(await sender(answer).send(chat, "hello", "deputy:ap1")).toEqual(answer);
  });

  test("a send id that cannot be used is a failed send and Intake is never called", async () => {
    const seen: unknown[] = [];
    expect(await sender({ kind: "sent", providerMessageIds: [] }, seen).send(chat, "x", "")).toEqual({ kind: "failed", reason: "rejected" });
    expect(seen).toEqual([]);
  });
});

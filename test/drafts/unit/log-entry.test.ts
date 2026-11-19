import { describe, expect, test } from "bun:test";
import { blankLogEntry } from "../../../src/drafts/domain/log-entry";
import { parseChatId } from "../../../src/shared/chat-id";

const CHAT = parseChatId("chat-a") ?? (() => { throw new Error("bad chat"); })();

describe("blankLogEntry", () => {
  test("a minimal entry has every other field null, so no mutant default (such as sendId) can slip in", () => {
    expect(blankLogEntry({ at: 5, kind: "order_deleted", chat: CHAT })).toEqual({
      at: 5, kind: "order_deleted", chat: CHAT,
      draft: null, draftKind: null, proposedText: null, finalText: null, reason: null,
      ownerWords: null, approvalEntryId: null, sendId: null, orderRef: null,
    });
  });
});

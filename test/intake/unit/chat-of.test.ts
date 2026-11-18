import { expect, test } from "bun:test";
import { chatOf, markOf } from "../../../src/intake/domain/chat-of";
import { PhoneNumber } from "../../../src/shared/phone-number";
import type { ProviderMessage } from "../../../src/intake/ports/provider";

const chat = (p: ProviderMessage): string => chatOf(p);

const pm = (over: Partial<ProviderMessage> = {}): ProviderMessage => ({
  providerMessageId: "m1",
  conversationRef: "conv",
  from: "5491123456789",
  counterpart: "5491123456789",
  direction: "inbound",
  type: "text",
  text: "x",
  transcript: null,
  sentAt: 1,
  origin: null,
  group: false,
  edited: false,
  profileName: null,
  devOwnerMark: false,
  ...over,
});

test("one line, one chat: the AR 9 is dropped", () => {
  expect(chat(pm())).toBe("+541123456789");
  expect(chat(pm({ counterpart: "541123456789" }))).toBe("+541123456789");
});

test("inbound with no counterpart falls back to the sender", () => {
  expect(chat(pm({ counterpart: null }))).toBe("+541123456789");
  expect(chat(pm({ counterpart: null, direction: "outbound" }))).toBe("unattributed");
});

test("group chat id falls back to the conversation, then to unknown", () => {
  expect(chat(pm({ group: true, counterpart: "g1" }))).toBe("group:g1");
  expect(chat(pm({ group: true, counterpart: null }))).toBe("group:conv");
  expect(chat(pm({ group: true, counterpart: null, conversationRef: null }))).toBe("group:unknown");
});

test("an unparseable counterpart is unattributed", () => {
  expect(chat(pm({ counterpart: "abc" }))).toBe("unattributed");
});

test("markOf order: group, not attributable, sender unknown", () => {
  const sender = PhoneNumber.fromInternational("5491123456789");
  expect(markOf(pm({ group: true }), null, chatOf(pm({ group: true })))).toBe("group_chat");
  expect(markOf(pm({ direction: "outbound" }), null, chatOf(pm()))).toBe("not_attributable");
  expect(markOf(pm(), null, chatOf(pm()))).toBe("sender_unknown");
  expect(markOf(pm(), sender, chatOf(pm()))).toBe("normal");
  expect(markOf(pm({ direction: "outbound" }), null, chatOf(pm()), true)).toBe("normal");
});

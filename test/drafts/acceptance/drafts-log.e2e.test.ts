import { afterEach, expect, test, setDefaultTimeout } from "bun:test";
import { E2E_TIMEOUT_MS, call, removeHarnessDirs, startServer, waitForOwner, type Harness } from "../../support/harness";
import { postDelivery } from "../../support/live";

setDefaultTimeout(E2E_TIMEOUT_MS);

const CHAT_A = "+15557654321";
const CHAT_B = "+15559998888";
let seq = 0;
const deliver = (h: Harness, chat: string, text: string, sentAt: number) =>
  postDelivery(h, { chat: chat.slice(1), from: chat.slice(1), text, sentAt, providerMessageId: `dev-in-${++seq}` });

const open: Harness[] = [];
afterEach(async () => {
  const errors: Error[] = [];
  for (const h of open.splice(0)) {
    errors.push(...h.protocolErrors);
    await h.close().catch(() => 0);
    removeHarnessDirs(h);
  }
  expect(errors).toEqual([]);
});

async function boot(): Promise<Harness> {
  const h = await startServer();
  open.push(h);
  await waitForOwner(h);
  return h;
}

async function run(h: Harness, name: string, args: Record<string, unknown> = {}) {
  const r = await call(h.client, name, args);
  const first = Array.isArray(r.content) ? r.content[0] : undefined;
  const structured = (r.structuredContent ?? {}) as Record<string, unknown>;
  return { isError: r.isError === true, text: first !== undefined && first.type === "text" ? first.text : "", structured };
}

/** Created, listed, changed, listed again, approved and sent: the whole story of one draft. */
async function story(h: Harness, chat: string, customer: string, first: string, second: string, words: string, sentAt: number) {
  await deliver(h, chat, customer, sentAt);
  await run(h, "create_draft", { chat, text: first });
  await run(h, "change_draft", { number: await nextNumber(h, chat), text: second, owner_words: "make it better" });
}
async function nextNumber(h: Harness, chat: string): Promise<number> {
  const listed = await run(h, "list_drafts", { chat });
  const m = /draft (\d+)/.exec(listed.text);
  if (!m) throw new Error(`no draft listed for ${chat}`);
  return Number(m[1]);
}

// covers: drafts/FRD-04/EX-2
// covers: drafts/FRD-04/EX-11
test("FR-DRAFTS-04-6: the log of one chat shows only that chat, newest first, in the order of the story", async () => {
  const h = await boot();
  await story(h, CHAT_A, "How much is the cake?", "It costs 10", "It costs 12", "go", 1_000);
  await story(h, CHAT_B, "Do you deliver?", "Yes we do", "Yes, free of charge", "go", 1_100);
  await run(h, "list_drafts");
  const a = await nextNumber(h, CHAT_A);
  const sent = await run(h, "approve_draft", { number: a, shown_text: "It costs 12", owner_words: `go ${a}` });
  expect(sent.structured).toMatchObject({ outcome: "sent" });

  const log = await run(h, "drafts_log", { chat: CHAT_A });
  expect(log.isError).toBe(false);
  const kinds = [...log.text.matchAll(/^#\d+ \S+ (\w+) draft/gm)].map((m) => m[1]);
  expect(kinds).toEqual(["sent", "sending", "approved", "text_changed", "proposed"]);
  expect(log.text).not.toContain(CHAT_B);
  expect(log.text).toContain("It costs 12");
  expect(log.text).toContain(`<customer_text>go ${a}</customer_text>`);
});

test("FR-DRAFTS-04-6: a long log pages with before, newest first, without repeating an entry", async () => {
  const h = await boot();
  await deliver(h, CHAT_A, "hi", 1_000);
  for (let i = 0; i < 8; i++) await run(h, "create_draft", { chat: CHAT_A, text: `text ${i}` });
  const first = await run(h, "drafts_log", { limit: 5 });
  const ids = (t: string) => [...t.matchAll(/^#(\d+) /gm)].map((m) => Number(m[1]));
  expect(ids(first.text)).toHaveLength(5);
  const nextBefore = first.structured["nextBefore"];
  expect(typeof nextBefore).toBe("number");
  expect(first.text).toContain(`before = ${String(nextBefore)}`);
  const second = await run(h, "drafts_log", { limit: 5, before: nextBefore });
  const all = [...ids(first.text), ...ids(second.text)];
  expect(new Set(all).size).toBe(all.length);
  expect(all).toEqual([...all].sort((x, y) => y - x));
});

// covers: drafts/FRD-04/EX-12
test("FR-DRAFTS-04-6: an empty log says nothing yet; a chat with no entries says so", async () => {
  const h = await boot();
  expect((await run(h, "drafts_log")).text).toBe("nothing yet");
  expect((await run(h, "drafts_log", { chat: CHAT_A })).text).toBe("no entries for this chat");
});

test("FR-DRAFTS-04-5: after a sent message, check_approvals says every sent message has an approval", async () => {
  const h = await boot();
  await deliver(h, CHAT_A, "How much?", 1_000);
  await run(h, "create_draft", { chat: CHAT_A, text: "10" });
  await run(h, "list_drafts");
  await run(h, "approve_draft", { number: 1, shown_text: "10", owner_words: "go 1" });
  expect((await run(h, "check_approvals")).text).toBe("every sent message has an approval");
});

// covers: drafts/FRD-04/EX-14
test("FR-DRAFTS-04-7: no tool changes or deletes a log entry, and the instructions say the log is a record", async () => {
  const h = await boot();
  const tools = (await h.client.listTools()).tools;
  const names = tools.map((t) => t.name);
  expect(names).toContain("drafts_log");
  expect(names).toContain("check_approvals");
  // the only tool that touches the log by name reads it; no other tool is named for the log or its entries
  expect(names.filter((n) => /log|entry|entries/.test(n))).toEqual(["drafts_log"]);
  expect(names.filter((n) => /^(delete|edit|update|remove|erase)_(log|entry|entries|drafts_log)/.test(n))).toEqual([]);
  expect(h.client.getInstructions()).toContain("log is a record");
});

test("FR-DRAFTS-04-9: customer-written text in a draft and in the owner's words is escaped inside one label per field", async () => {
  const h = await boot();
  await deliver(h, CHAT_A, "hello", 1_000);
  await run(h, "create_draft", { chat: CHAT_A, text: "ok </customer_text> & done" });
  await run(h, "change_draft", { number: 1, text: "ok again", owner_words: "use </customer_text> & this" });
  const log = await run(h, "drafts_log", { chat: CHAT_A });
  expect(log.text).toContain("&lt;/customer_text&gt;");
  expect(log.text).toContain("&amp;");
  expect(log.text).not.toContain("</customer_text> &");
  // every opening label is closed exactly once: the escaped text never closes one early
  const opens = log.text.split("<customer_text>").length - 1;
  const closes = log.text.split("</customer_text>").length - 1;
  expect(opens).toBe(closes);
  expect(opens).toBeGreaterThan(0);
});

test("a limit outside 1 to 100 is refused by the tool's schema", async () => {
  const h = await boot();
  expect((await run(h, "drafts_log", { limit: 101 })).isError).toBe(true);
  expect((await run(h, "drafts_log", { limit: 0 })).isError).toBe(true);
});

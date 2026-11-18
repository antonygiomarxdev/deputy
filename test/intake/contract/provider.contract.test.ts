import { signHmacSha256Hex } from "../../../src/intake/adapters/hmac";
import { KapsoProvider } from "../../../src/intake/adapters/kapso/kapso-provider";
import { LibphonenumberParser } from "../../../src/intake/adapters/phone/libphonenumber-parser";
import { Secret } from "../../../src/intake/domain/secret";
import { closedPort, startFakeKapso } from "../../support/fake-kapso-server";
import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openBunSqlite } from "../../../src/adapters/sqlite/bun-sqlite-database";
import { migrate } from "../../../src/adapters/sqlite/migrate";
import { DEV_SIGNATURE_HEADER, signDevBody } from "../../../src/intake/adapters/dev/dev-delivery";
import { DevProvider } from "../../../src/intake/adapters/dev/dev-provider";
import type { Provider, ProviderMessage } from "../../../src/intake/ports/provider";
import { PhoneNumber } from "../../../src/shared/phone-number";
import { FakeClock } from "../../support/fake-clock";

const root = join(import.meta.dir, "..", "..", "..");
const sql = (p: string) => readFileSync(join(root, p), "utf8");
const signal = new AbortController().signal;
const port = (p: Provider): Provider => p;

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const c of cleanups.splice(0)) c();
});

const FIELDS: (keyof ProviderMessage)[] = [
  "providerMessageId", "conversationRef", "from", "counterpart", "direction", "type", "text",
  "transcript", "sentAt", "origin", "group", "edited", "profileName", "devOwnerMark",
];

async function dev() {
  const dir = mkdtempSync(join(tmpdir(), "deputy-dev-"));
  const path = join(dir, "deputy.db");
  const db = openBunSqlite({ path });
  cleanups.push(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  await migrate(
    db,
    [
      { name: "0001-shared", sql: sql("src/adapters/sqlite/migrations/0001-shared.sql") },
      { name: "0001-owner-numbers", sql: sql("src/intake/adapters/sqlite/migrations/0001-owner-numbers.sql") },
      { name: "0002-dev-holdings", sql: sql("src/intake/adapters/sqlite/migrations/0002-dev-holdings.sql") },
    ],
    { basePath: path, copyTo: async () => {} },
  );
  const clock = new FakeClock(1_000_000);
  return { provider: new DevProvider({ db, clock }), clock };
}

describe("DevProvider", () => {
  test("FR-INTAKE-01-4, 01-6: listings are newest first, paged, with owner and history marks and every field", async () => {
    const { provider } = await dev();
    await provider.hold({ chat: "c1", from: "15557654321", text: "one", sentAt: 100 });
    await provider.hold({ chat: "c1", from: "15550001111", text: "owner says", owner: true, sentAt: 200 });
    await provider.hold({ chat: "c1", from: "15557654321", text: "old", history: true, sentAt: 50 });

    const conv = await port(provider).listMessages({ scope: { conversationRef: "c1" }, cursor: null, limit: 2 }, signal);
    expect(conv.items.map((m) => m.text)).toEqual(["owner says", "one"]);
    expect(conv.next).not.toBeNull();
    const rest = await port(provider).listMessages({ scope: { conversationRef: "c1" }, cursor: conv.next, limit: 2 }, signal);
    expect(rest.items.map((m) => m.text)).toEqual(["old"]);
    expect(rest.items[0]?.origin).toBe("history_sync");
    expect(rest.next).toBeNull();

    const out = await port(provider).listMessages({ scope: { outbound: true }, cursor: null, limit: 10 }, signal);
    expect(out.items).toHaveLength(1);
    expect(out.items[0]).toMatchObject({ devOwnerMark: true, origin: "business_app", direction: "outbound" });
    for (const m of [...conv.items, ...out.items]) for (const f of FIELDS) expect(m).toHaveProperty(f);
  });

  test("FR-INTAKE-01-6: a held, undelivered body is listed by activeAfter, an older one is not", async () => {
    const { provider } = await dev();
    await provider.hold({ chat: "old", from: "1555", text: "a", sentAt: 100 });
    await provider.hold({ chat: "new", from: "1555", text: "b", sentAt: 900 });
    const page = await port(provider).listConversations({ activeAfter: 500, cursor: null, limit: 10 }, signal);
    expect(page.items).toEqual([{ ref: "new", counterpart: "new", group: false, lastActiveAt: 900 }]);
    const all = await port(provider).listConversations({ activeAfter: null, cursor: null, limit: 10 }, signal);
    expect(all.items.map((c) => c.ref)).toEqual(["new", "old"]);
  });

  test("FR-INTAKE-01-5: signature checks and the ignored configured secret", async () => {
    const { provider } = await dev();
    const raw = new TextEncoder().encode(JSON.stringify({ chat: "c", from: "1555", text: "hi" }));
    const sign = (b: Uint8Array) => new Map([[DEV_SIGNATURE_HEADER, signDevBody(b)]]);

    const ok = port(provider).verifyAndParse({ rawBody: raw, headers: sign(raw), secret: null });
    expect(ok.kind).toBe("ok");
    if (ok.kind === "ok") {
      expect(ok.events).toHaveLength(1);
      expect(ok.events[0]).toMatchObject({ kind: "message", message: { text: "hi", conversationRef: "c" } });
    }
    expect(port(provider).verifyAndParse({ rawBody: raw, headers: sign(raw), secret: "other" }).kind).toBe("ok");
    expect(port(provider).verifyAndParse({ rawBody: raw, headers: new Map([[DEV_SIGNATURE_HEADER, "sha256=00"]]), secret: null }).kind).toBe("bad_signature");
    expect(port(provider).verifyAndParse({ rawBody: raw, headers: new Map(), secret: null }).kind).toBe("missing_signature");
    const junk = new TextEncoder().encode("not json");
    expect(port(provider).verifyAndParse({ rawBody: junk, headers: sign(junk), secret: null }).kind).toBe("malformed");
  });

  test("sendText is listed as an outbound cloud_api holding with a dev-out id", async () => {
    const { provider } = await dev();
    const to = PhoneNumber.fromInternational("+15557654321");
    if (to === null) throw new Error("bad number");
    const sent = await port(provider).sendText({ to, text: "hello" }, signal);
    expect(sent.providerMessageId).toMatch(/^dev-out-\d+$/);
    const out = await port(provider).listMessages({ scope: { outbound: true }, cursor: null, limit: 10 }, signal);
    expect(out.items[0]).toMatchObject({ providerMessageId: sent.providerMessageId, origin: "cloud_api", direction: "outbound", text: "hello", devOwnerMark: false });
  });

  test("businessNumber is null", async () => {
    const { provider } = await dev();
    const p = port(provider);
    expect(await p.businessNumber(signal)).toBeNull();
  });
});

const fixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(root, "test", "fixtures", "kapso", `${name}.json`), "utf8"));

function kapso(opts: Partial<Parameters<typeof startFakeKapso>[0]> = {}, timeoutMs?: number) {
  const server = startFakeKapso({ apiKey: "key-1", phoneNumberId: "pn-1", ...opts });
  cleanups.push(() => server.stop());
  const provider = new KapsoProvider({
    baseUrl: server.url,
    graphVersion: "v24.0",
    apiKey: new Secret("key-1"),
    phoneNumberId: "pn-1",
    clock: new FakeClock(5_000_000),
    parser: new LibphonenumberParser(),
    ...(timeoutMs === undefined ? {} : { requestTimeoutMs: timeoutMs }),
  });
  return { server, provider: port(provider) };
}

const failure = (p: Promise<unknown>) =>
  p.then(
    () => "no error",
    (e: unknown) => e,
  );

const SERVER_TIME = Date.parse("Tue, 14 Nov 2023 22:20:00 GMT");

describe("KapsoProvider", () => {
  test("FR-INTAKE-01-2: listings carry the item, serverTime, remaining and a cursor while paging.next is set", async () => {
    const { server, provider } = kapso({
      conversations: [fixture("conversation")],
      messages: [fixture("text-message"), fixture("audio-message"), fixture("image-message")],
    });
    const convs = await provider.listConversations({ activeAfter: null, cursor: null, limit: 10 }, signal);
    expect(convs.items).toEqual([
      { ref: "conv-1", counterpart: "+15557654321", group: false, lastActiveAt: Date.parse("2023-11-14T22:15:00.000Z") },
    ]);
    expect(convs.serverTime).toBe(SERVER_TIME);
    expect(convs.remaining).toBe(98);
    expect(convs.next).toBeNull();

    const first = await provider.listMessages({ scope: { conversationRef: "conv-1" }, cursor: null, limit: 2 }, signal);
    expect(first.items.map((m) => m.providerMessageId)).toEqual(["wamid.TEXT1", "wamid.AUDIO1"]);
    expect(first.next).not.toBeNull();
    const last = await provider.listMessages({ scope: { conversationRef: "conv-1" }, cursor: first.next, limit: 2 }, signal);
    expect(last.items.map((m) => m.type)).toEqual(["image"]);
    expect(last.next).toBeNull();
    expect(server.state.requests[0]).toContain("phone_number_id=pn-1");
  });

  test("activeAfter is sent as last_active_after", async () => {
    const { server, provider } = kapso({ conversations: [fixture("conversation")] });
    const after = Date.parse("2023-11-15T00:00:00Z");
    const page = await provider.listConversations({ activeAfter: after, cursor: null, limit: 5 }, signal);
    expect(page.items).toEqual([]);
    expect(server.state.requests[0]).toContain("last_active_after=2023-11-15T00%3A00%3A00.000Z");
  });

  test("mapping: origin as received, transcript, direction, counterpart, unknown type", async () => {
    const noType: Record<string, unknown> = { ...fixture("text-message"), id: "wamid.NOTYPE" };
    delete noType["type"];
    const { provider } = kapso({
      messages: [fixture("owner-echo-message"), fixture("audio-message"), fixture("history-message"), noType],
    });
    const out = await provider.listMessages({ scope: { outbound: true }, cursor: null, limit: 10 }, signal);
    expect(out.items).toHaveLength(1);
    expect(out.items[0]).toMatchObject({
      origin: "business_app",
      direction: "outbound",
      counterpart: "15557654321",
      from: "15550001111",
      sentAt: 1_700_000_400_000,
    });
    const all = await provider.listMessages({ scope: { conversationRef: "conv-1" }, cursor: null, limit: 10 }, signal);
    const byId = (id: string) => all.items.find((m) => m.providerMessageId === id);
    expect(byId("wamid.AUDIO1")).toMatchObject({
      transcript: "Do you deliver on Sundays?",
      text: null,
      type: "audio",
      counterpart: "15557654321",
    });
    expect(byId("wamid.HIST1")?.origin).toBe("history_sync");
    expect(byId("wamid.NOTYPE")?.type).toBe("unknown");
  });

  test("FR-INTAKE-01-4: a Kapso and a dev message have the same keys and value kinds", async () => {
    const { provider } = kapso({ messages: [fixture("text-message")] });
    const k = (await provider.listMessages({ scope: { conversationRef: "conv-1" }, cursor: null, limit: 1 }, signal)).items[0];
    const { provider: devProvider } = await dev();
    await devProvider.hold({ chat: "conv-1", from: "15557654321", text: "How much is the cake?" });
    const d = (await port(devProvider).listMessages({ scope: { conversationRef: "conv-1" }, cursor: null, limit: 1 }, signal)).items[0];
    if (k === undefined || d === undefined) throw new Error("no message");
    expect(Object.keys(k).sort()).toEqual(Object.keys(d).sort());
    for (const key of Object.keys(k) as (keyof ProviderMessage)[]) {
      if (k[key] !== null && d[key] !== null) expect(typeof k[key]).toBe(typeof d[key]);
    }
  });

  test("sendText posts the documented request with X-API-Key and returns id and serverTime", async () => {
    const { server, provider } = kapso({ sendResponse: fixture("send-response") });
    const to = PhoneNumber.fromInternational("+15557654321");
    if (to === null) throw new Error("bad number");
    const sent = await provider.sendText({ to, text: "hello" }, signal);
    expect(sent).toEqual({ providerMessageId: "wamid.SENT1", serverTime: SERVER_TIME });
    const req = server.state.sent[0];
    expect(req?.path).toBe("/meta/whatsapp/v24.0/pn-1/messages");
    expect(req?.headers.get("x-api-key")).toBe("key-1");
    expect(req?.body).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "15557654321",
      type: "text",
      text: { body: "hello", preview_url: false },
    });
  });

  describe("verifyAndParse", () => {
    const secret = "hook-secret";
    const body = new TextEncoder().encode(JSON.stringify(fixture("live-text-delivery")));
    const headers = (extra: Record<string, string> = {}) =>
      new Map([["x-webhook-signature", `sha256=${signHmacSha256Hex(secret, body)}`], ...Object.entries(extra)]);

    test("a signed delivery maps to one message event", () => {
      const { provider } = kapso();
      const r = provider.verifyAndParse({ rawBody: body, headers: headers({ "x-webhook-event": "whatsapp.message.received" }), secret });
      expect(r.kind).toBe("ok");
      if (r.kind === "ok") {
        expect(r.events).toHaveLength(1);
        expect(r.events[0]).toMatchObject({
          kind: "message",
          message: { providerMessageId: "wamid.LIVE1", conversationRef: "conv-1", text: "Hello live", direction: "inbound" },
        });
      }
    });

    test("secret and signature failures", () => {
      const { provider } = kapso();
      expect(provider.verifyAndParse({ rawBody: body, headers: headers(), secret: "wrong" }).kind).toBe("bad_signature");
      expect(provider.verifyAndParse({ rawBody: body, headers: new Map(), secret }).kind).toBe("missing_signature");
      expect(provider.verifyAndParse({ rawBody: body, headers: headers(), secret: null }).kind).toBe("no_secret");
    });

    test("a body that is not the expected JSON is malformed", () => {
      const { provider } = kapso();
      const junk = new TextEncoder().encode('{"nope":1}');
      const h = new Map([["x-webhook-signature", signHmacSha256Hex(secret, junk)]]);
      expect(provider.verifyAndParse({ rawBody: junk, headers: h, secret }).kind).toBe("malformed");
    });

    test("delivered and read events and reactions are ignored", () => {
      const { provider } = kapso();
      for (const event of ["whatsapp.message.delivered", "whatsapp.message.read"]) {
        const r = provider.verifyAndParse({ rawBody: body, headers: headers({ "x-webhook-event": event }), secret });
        expect(r).toEqual({ kind: "ok", events: [{ kind: "ignored", reason: "receipt" }] });
      }
      const raw = new TextEncoder().encode(JSON.stringify(fixture("live-text-delivery")).replace('"type":"text"', '"type":"reaction"'));
      const h = new Map([["x-webhook-signature", signHmacSha256Hex(secret, raw)]]);
      expect(provider.verifyAndParse({ rawBody: raw, headers: h, secret })).toEqual({
        kind: "ok",
        events: [{ kind: "ignored", reason: "reaction" }],
      });
    });
  });

  describe("errors", () => {
    test("429 with Retry-After is rate_limited with the wait in ms", async () => {
      const { server, provider } = kapso();
      server.force("conversations", { status: 429, headers: { "Retry-After": "30" } });
      const e = await failure(provider.listConversations({ activeAfter: null, cursor: null, limit: 1 }, signal));
      expect(e).toMatchObject({ kind: "rate_limited", retryAfterMs: 30_000, mayHaveBeenAccepted: false });
    });

    test.each([
      [401, "credentials"],
      [403, "credentials"],
      [402, "quota"],
    ] as const)("%d is %s and the message holds no response text", async (status, kind) => {
      const { server, provider } = kapso();
      server.force("conversations", { status, body: status === 402 ? fixture("quota-response") : {} });
      const e = await failure(provider.listConversations({ activeAfter: null, cursor: null, limit: 1 }, signal));
      expect(e).toMatchObject({ kind, message: kind });
    });

    test("a body of the wrong shape is bad_response", async () => {
      const { server, provider } = kapso();
      server.force("conversations", { status: 200, body: { data: "nope" } });
      const e = await failure(provider.listConversations({ activeAfter: null, cursor: null, limit: 1 }, signal));
      expect(e).toMatchObject({ kind: "bad_response" });
    });

    test("connection refused is unreachable", async () => {
      const provider = port(
        new KapsoProvider({
          baseUrl: `http://127.0.0.1:${await closedPort()}`,
          graphVersion: "v24.0",
          apiKey: new Secret("key-1"),
          phoneNumberId: "pn-1",
          clock: new FakeClock(0),
          parser: new LibphonenumberParser(),
        }),
      );
      const e = await failure(provider.listConversations({ activeAfter: null, cursor: null, limit: 1 }, signal));
      expect(e).toMatchObject({ kind: "unreachable" });
    });

    test("a slow response is timeout; on a send it may have been accepted, a 401 on a send was not", async () => {
      const { server, provider } = kapso({}, 100);
      const to = PhoneNumber.fromInternational("+15557654321");
      if (to === null) throw new Error("bad number");
      server.delay("send", 400);
      expect(await failure(provider.sendText({ to, text: "x" }, signal))).toMatchObject({ kind: "timeout", mayHaveBeenAccepted: true });
      server.delay("send", 0);
      server.force("send", { status: 401 });
      expect(await failure(provider.sendText({ to, text: "x" }, signal))).toMatchObject({ kind: "credentials", mayHaveBeenAccepted: false });
    });
  });

  test("businessNumber parses the display number; no number is null", async () => {
    const withNumber = kapso({ phoneNumberRecord: fixture("phone-number") });
    expect((await withNumber.provider.businessNumber(signal))?.e164).toBe("+50588881111");
    const without = kapso({ phoneNumberRecord: { data: {} } });
    expect(await without.provider.businessNumber(signal)).toBeNull();
  });
});

test("KapsoProvider refuses a limit below 1 at the port", async () => {
  const { provider } = kapso();
  await expect(provider.listConversations({ activeAfter: null, cursor: null, limit: 0 }, signal)).rejects.toThrow(RangeError);
  await expect(provider.listMessages({ scope: { outbound: true }, cursor: null, limit: 0 }, signal)).rejects.toThrow(RangeError);
});

describe("KapsoProvider review findings", () => {
  test("a last page whose paging.cursors.after is set but paging.next is null has no next cursor", async () => {
    const { server, provider } = kapso();
    server.force("messages", {
      status: 200,
      body: { data: [fixture("text-message")], paging: { cursors: { after: "AAA" }, next: null } },
    });
    const page = await provider.listMessages({ scope: { conversationRef: "conv-1" }, cursor: null, limit: 1 }, signal);
    expect(page.items).toHaveLength(1);
    expect(page.next).toBeNull();
  });

  test("the sender profile name is null until a Kapso path is confirmed", async () => {
    const withName = { ...fixture("text-message"), kapso: { ...(fixture("text-message")["kapso"] as object), contact_name: "Ana" } };
    const { provider } = kapso({ messages: [withName] });
    const page = await provider.listMessages({ scope: { conversationRef: "conv-1" }, cursor: null, limit: 1 }, signal);
    expect(page.items[0]?.profileName).toBeNull();
  });

  test("an unknown event is ignored and logged by name and count only; receipts are silent", () => {
    const log = spyOn(console, "error").mockImplementation(() => {});
    const { provider } = kapso();
    const secret = "hook-secret";
    const raw = new TextEncoder().encode('{"private":"customer text"}');
    const headers = (event: string) =>
      new Map([
        ["x-webhook-signature", signHmacSha256Hex(secret, raw)],
        ["x-webhook-event", event],
      ]);
    for (const event of ["whatsapp.conversation.created", "whatsapp.conversation.created", "whatsapp.message.read"]) {
      expect(provider.verifyAndParse({ rawBody: raw, headers: headers(event), secret })).toEqual({
        kind: "ok",
        events: [{ kind: "ignored", reason: "receipt" }],
      });
    }
    expect(log.mock.calls.map((c) => String(c[0]))).toEqual([
      "deputy: ignored Kapso event whatsapp.conversation.created (1 so far)",
      "deputy: ignored Kapso event whatsapp.conversation.created (2 so far)",
    ]);
    log.mockRestore();
  });

  test("429 without Retry-After leaves the wait to the caller (null)", async () => {
    const { server, provider } = kapso();
    server.force("conversations", { status: 429 });
    const e = await failure(provider.listConversations({ activeAfter: null, cursor: null, limit: 1 }, signal));
    expect(e).toMatchObject({ kind: "rate_limited", retryAfterMs: null });
  });
});

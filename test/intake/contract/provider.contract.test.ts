import { afterEach, describe, expect, test } from "bun:test";
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

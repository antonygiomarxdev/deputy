import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { KapsoProvider } from "../../../src/intake/adapters/kapso/kapso-provider";
import { LibphonenumberParser } from "../../../src/intake/adapters/phone/libphonenumber-parser";
import { Secret } from "../../../src/intake/domain/secret";
import { createCheckProviderAccess } from "../../../src/intake/index";
import type { Provider } from "../../../src/intake/ports/provider";
import { FakeClock } from "../../support/fake-clock";
import { startFakeKapso } from "../../support/fake-kapso-server";

const stops: (() => void)[] = [];
afterEach(() => {
  for (const s of stops.splice(0)) s();
});

function check(record: unknown) {
  const server = startFakeKapso({ apiKey: "key-1", phoneNumberId: "pn-1", phoneNumberRecord: record });
  stops.push(() => server.stop());
  const provider = new KapsoProvider({
    baseUrl: server.url,
    graphVersion: "v24.0",
    apiKey: new Secret("key-1"),
    phoneNumberId: "pn-1",
    clock: new FakeClock(0),
    parser: new LibphonenumberParser(),
  });
  return { server, run: () => createCheckProviderAccess(provider).execute() };
}

const phoneRecord: unknown = JSON.parse(
  readFileSync(join(import.meta.dir, "../../fixtures/kapso/phone-number.json"), "utf8"),
);

test("FR-INTAKE-01-8: the business number comes back in E.164", async () => {
  expect(await check(phoneRecord).run()).toEqual({ ok: true, businessNumber: "+12125550104" });
});

test("FR-INTAKE-01-8: a record without a number gives null", async () => {
  expect(await check({ data: {} }).run()).toEqual({ ok: true, businessNumber: null });
});

test("FR-INTAKE-01-8: the dev provider gives null", async () => {
  const empty = { items: [], next: null, serverTime: 0, remaining: null };
  const dev: Provider = {
    name: "dev",
    listConversations: async () => empty,
    listMessages: async () => empty,
    sendText: async () => ({ providerMessageId: "x", serverTime: 0 }),
    verifyAndParse: () => ({ kind: "malformed" }),
    businessNumber: async () => null,
  };
  expect(await createCheckProviderAccess(dev).execute()).toEqual({ ok: true, businessNumber: null });
});

test("FR-INTAKE-01-8: 401 is credentials, 429 is usage_limit, 402 is quota", async () => {
  const c = check(phoneRecord);
  c.server.force("conversations", { status: 401 });
  expect(await c.run()).toEqual({ ok: false, reason: "credentials" });
  c.server.force("conversations", { status: 429, headers: { "Retry-After": "5" } });
  expect(await c.run()).toEqual({ ok: false, reason: "usage_limit" });
  c.server.force("conversations", { status: 402 });
  expect(await c.run()).toEqual({ ok: false, reason: "quota" });
});

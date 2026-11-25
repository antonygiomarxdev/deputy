import { describe, expect, test } from "bun:test";
import { Secret } from "../../../src/intake/domain/secret";
import { OwnerNumbers } from "../../../src/intake/domain/owner-numbers";
import { InMemoryOwnerNumbersRepository } from "../../../src/intake/adapters/memory/in-memory-owner-numbers-repository";
import { createIntake } from "../../../src/intake/index";
import type { IntakeConnectionConfig } from "../../../src/intake/ports/intake-connection-config";
import { PhoneNumber } from "../../../src/shared/phone-number";

type Config = Awaited<ReturnType<IntakeConnectionConfig["read"]>>;

async function resolve(
  over: { provider?: string | null; receivingMode?: string | null; apiKey?: boolean; apiKeyValue?: string; phoneNumberId?: string | null; webhookSecret?: boolean; business?: boolean },
) {
  const config: Config = {
    provider: over.provider ?? null,
    receivingMode: over.receivingMode ?? null,
    kapso: {
      apiKey: over.apiKey ? new Secret(over.apiKeyValue ?? "sk-secret-value") : null,
      phoneNumberId: over.phoneNumberId ?? null,
      webhookSecret: over.webhookSecret ? new Secret("whsec-secret-value") : null,
    },
  };
  const owners = new InMemoryOwnerNumbersRepository();
  if (over.business) {
    const set = OwnerNumbers.empty();
    const number = PhoneNumber.fromInternational("+5491123456789");
    if (!number) throw new Error("bad fixture number");
    set.add({ number, kind: "business", label: "business", addedAt: 0 });
    await owners.save(set, []);
  }
  return createIntake({ config: { read: async () => config }, owners }).resolveProviderSettings.execute();
}

const kapsoAll = { provider: "kapso", apiKey: true, phoneNumberId: "123", business: true };

describe("FR-INTAKE-01-1", () => {
  // covers: intake/FRD-01/EX-1
  test("provider meta is refused and the message names kapso and dev", async () => {
    const r = await resolve({ provider: "meta" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe("provider must be kapso or dev, got 'meta'");
  });
  // covers: intake/FRD-01/EX-2
  test.each([null, ""])("provider %p gives dev with a notice and never kapso", async (provider) => {
    const r = await resolve({ provider, ...{ apiKey: true, phoneNumberId: "1", business: true } });
    expect(r).toEqual({ ok: true, provider: "dev", receiving: "catch_up", notices: ["no provider set, using dev"] });
  });
});

describe("FR-INTAKE-01-8", () => {
  test("kapso without an api key is refused, mentions Setup and holds no secret value", async () => {
    const r = await resolve({ ...kapsoAll, apiKey: false, webhookSecret: true });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toBe("Kapso needs: api key. Run Setup.");
      expect(r.message).not.toContain("secret-value");
    }
  });
  test.each(["", "   "])("a blank api key %p counts as missing", async (apiKeyValue) => {
    const r = await resolve({ ...kapsoAll, apiKeyValue });
    expect(r).toEqual({ ok: false, message: "Kapso needs: api key. Run Setup." });
  });
  // covers: intake/FRD-01/EX-17
  test("every missing item is listed", async () => {
    const r = await resolve({ provider: "kapso", receivingMode: "live" });
    expect(r).toEqual({ ok: false, message: "Kapso needs: api key, phone number id, webhook secret, business number. Run Setup." });
  });
  test("api key, phone number id and business number present gives ok kapso", async () => {
    expect(await resolve(kapsoAll)).toEqual({ ok: true, provider: "kapso", receiving: "catch_up", notices: [] });
  });
  test("live asks for the webhook secret; catch-up does not", async () => {
    const live = await resolve({ ...kapsoAll, receivingMode: "live" });
    expect(live).toEqual({ ok: false, message: "Kapso needs: webhook secret. Run Setup." });
    expect((await resolve({ ...kapsoAll, receivingMode: "catch-up" })).ok).toBe(true);
  });
});

describe("FR-INTAKE-01-11", () => {
  test("kapso: empty is catch_up, live is live", async () => {
    expect(await resolve(kapsoAll)).toMatchObject({ ok: true, receiving: "catch_up" });
    expect(await resolve({ ...kapsoAll, receivingMode: "live", webhookSecret: true })).toMatchObject({ ok: true, receiving: "live" });
  });
  test("Kapso items are checked before receiving_mode (TP-01 rule order)", async () => {
    const r = await resolve({ ...kapsoAll, apiKey: false, receivingMode: "weekly" });
    expect(r).toEqual({ ok: false, message: "Kapso needs: api key. Run Setup." });
  });
  test("weekly is refused and the message lists catch-up and live", async () => {
    const r = await resolve({ ...kapsoAll, receivingMode: "weekly" });
    expect(r).toEqual({ ok: false, message: "receiving_mode must be catch-up or live, got 'weekly'" });
  });
  // covers: intake/FRD-01/EX-18
  test("dev with live is catch_up", async () => {
    expect(await resolve({ provider: "dev", receivingMode: "live" })).toEqual({ ok: true, provider: "dev", receiving: "catch_up", notices: [] });
  });
});

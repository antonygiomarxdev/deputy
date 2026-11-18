import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import { InMemoryIntakeSettingsRepository } from "../../../src/intake/adapters/memory/in-memory-intake-settings-repository";
import { InMemoryIntakeStore } from "../../../src/intake/adapters/memory/in-memory-intake-store";
import { LibphonenumberParser } from "../../../src/intake/adapters/phone/libphonenumber-parser";
import { ApplyPendingChangesUseCase } from "../../../src/intake/application/apply-pending-changes";
import { DescribeNumberUseCase } from "../../../src/intake/application/describe-number";
import { GetOwnerNumbersUseCase } from "../../../src/intake/application/get-owner-numbers";
import { StoreMessages } from "../../../src/intake/application/store-messages";
import { OwnerNumbers } from "../../../src/intake/domain/owner-numbers";
import type { PendingChange } from "../../../src/intake/ports/pending-changes-reader";
import type { ProviderMessage } from "../../../src/intake/ports/provider";
import { PhoneNumber } from "../../../src/shared/phone-number";
import { FakeClock } from "../../support/fake-clock";
import { InMemoryOwnerLease, type LeaseHolder } from "../../support/in-memory-owner-lease";
import { providerMessage } from "../../support/intake-fixtures";

const BUSINESS = "+50588880000";
const N2 = "+505 8888 2222";
const N3 = "+505 8888 3333";
const N4 = "+505 8888 4444";
const NOW = 50_000;
const phone = (raw: string): PhoneNumber => {
  const n = PhoneNumber.fromInternational(raw);
  if (n === null) throw new Error(raw);
  return n;
};
const entry = (raw: string, kind: "business" | "extra") => ({ number: phone(raw), kind, label: "", addedAt: 1 });

let holder: LeaseHolder;
let clock: FakeClock;
let lease: InMemoryOwnerLease;
let store: InMemoryIntakeStore;
let settings: InMemoryIntakeSettingsRepository;
let service: StoreMessages;
let apply: ApplyPendingChangesUseCase;

beforeEach(async () => {
  holder = { token: "me", heartbeat: 1 };
  clock = new FakeClock(NOW);
  lease = new InMemoryOwnerLease(holder, clock, "me");
  store = new InMemoryIntakeStore(lease);
  settings = new InMemoryIntakeSettingsRepository();
  service = new StoreMessages({ clock });
  apply = new ApplyPendingChangesUseCase({ lease, unitOfWork: store.unitOfWork, parser: new LibphonenumberParser(), settings, clock });
  await settings.setCountry("NI", 1);
  await store.repos.owners.save(OwnerNumbers.of([entry(BUSINESS, "business")]), []);
});

const setOwners = (...entries: ReturnType<typeof entry>[]) => store.repos.owners.save(OwnerNumbers.of(entries), []);
const row = (key: PendingChange["key"], value: string, command = `deputy config ${key} ${value}`, at = 1_000) =>
  store.addPendingChange(key, value, command, at);
const put = (...messages: ProviderMessage[]) =>
  store.unitOfWork.run((r) => service.store(r, { provider: "kapso", events: messages.map((message) => ({ kind: "message" as const, message })) }));
const from = (id: string, sender: string, over: Partial<ProviderMessage> = {}) =>
  providerMessage({ providerMessageId: id, from: sender.replace(/[^0-9]/g, ""), counterpart: sender.replace(/[^0-9]/g, ""), ...over });
const sourceOf = async (id: string) => (await store.repos.messages.find({ provider: "kapso", providerMessageId: id }))?.props.source;
const numbers = async () => (await store.repos.owners.load()).entries().map((e) => `${e.kind} ${e.number.e164}`).sort();
const unapplied = async () => (await store.repos.pending.takeOwnerNumberChanges()).length;
const stderr = () => spyOn(console, "error").mockImplementation(() => {});

describe("ApplyPendingChanges", () => {
  test("FR-INTAKE-04-9: an added number leaves old messages as customer and makes new ones owner_app; one add log row with the typed command", async () => {
    await put(from("old", N2));
    expect(await sourceOf("old")).toBe("customer");
    row("owner_numbers", N2, `deputy config set owner-numbers "${N2}"`);
    expect(await apply.execute()).toEqual({ applied: 1 });
    await put(from("new", N2));
    expect(await sourceOf("old")).toBe("customer");
    expect(await sourceOf("new")).toBe("owner_app");
    expect(await store.repos.owners.log()).toEqual([
      { at: NOW, action: "add", number: "+50588882222", kind: "extra", label: "", command: `deputy config set owner-numbers "${N2}"` },
    ]);
    expect(await unapplied()).toBe(0);
  });

  test("FR-INTAKE-04-9: a removed extra is gone, new messages from it are customer, old ones keep their source, one remove log row", async () => {
    await setOwners(entry(BUSINESS, "business"), entry(N2, "extra"));
    await put(from("old", N2));
    expect(await sourceOf("old")).toBe("owner_app");
    row("owner_number_remove", N2, `deputy config remove owner-number "${N2}"`);
    expect(await apply.execute()).toEqual({ applied: 1 });
    await put(from("new", N2));
    expect(await sourceOf("old")).toBe("owner_app");
    expect(await sourceOf("new")).toBe("customer");
    expect(await store.repos.owners.log()).toEqual([
      { at: NOW, action: "remove", number: "+50588882222", kind: "extra", label: "", command: `deputy config remove owner-number "${N2}"` },
    ]);
  });

  test("FR-INTAKE-04-9: removing the business number, or one that is not in the set, changes nothing, marks the row applied and says so on stderr", async () => {
    const log = stderr();
    await setOwners(entry(BUSINESS, "business"), entry(N2, "extra"));
    row("owner_number_remove", BUSINESS);
    row("owner_number_remove", N4);
    expect(await apply.execute()).toEqual({ applied: 2 });
    expect(await numbers()).toEqual([`business ${BUSINESS}`, "extra +50588882222"]);
    expect(await store.repos.owners.log()).toEqual([]);
    expect(await unapplied()).toBe(0);
    const lines = log.mock.calls.map((c) => String(c[0]));
    log.mockRestore();
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("business number");
    expect(lines[1]).toContain("not in the set");
  });

  test("FR-INTAKE-04-1: an owner_numbers row adds the missing numbers and removes the absent extra; the business number stays", async () => {
    await setOwners(entry(BUSINESS, "business"), entry(N4, "extra"));
    row("owner_numbers", `${N2}, ${N3}`);
    await apply.execute();
    expect(await numbers()).toEqual([`business ${BUSINESS}`, "extra +50588882222", "extra +50588883333"]);
    const log = await store.repos.owners.log();
    expect(log.map((l) => `${l.action} ${l.number}`)).toEqual(["remove +50588884444", "add +50588882222", "add +50588883333"]);
  });

  test("FR-INTAKE-04-1: a business_number row with another number removes the old and adds the new (two log rows); an empty value or the same line changes nothing", async () => {
    row("business_number", "+505 8888 7777");
    await apply.execute();
    expect(await numbers()).toEqual(["business +50588887777"]);
    expect((await store.repos.owners.log()).map((l) => `${l.action} ${l.kind} ${l.number}`)).toEqual([
      `remove business ${BUSINESS}`,
      "add business +50588887777",
    ]);

    const log = stderr();
    row("business_number", "");
    row("business_number", "+50588887777");
    await apply.execute();
    expect(await numbers()).toEqual(["business +50588887777"]);
    expect(await store.repos.owners.log()).toHaveLength(2);
    expect(log).not.toHaveBeenCalled(); // an empty value is not an error, it is no change
    log.mockRestore();
  });

  test("a number that was an extra and becomes the business number leaves the extra", async () => {
    await setOwners(entry(BUSINESS, "business"), entry(N2, "extra"));
    row("business_number", N2.replace(/ /g, ""));
    await apply.execute();
    expect(await numbers()).toEqual(["business +50588882222"]);
    expect((await store.repos.owners.log()).map((l) => `${l.action} ${l.kind}`)).toEqual(["remove business", "remove extra", "add business"]);
  });

  test("FR-INTAKE-04-14: a number with no country code and no default country is refused: applied, no change, a line on stderr", async () => {
    const log = stderr();
    await settings.setCountry("NI", 1);
    const noCountry = new InMemoryIntakeSettingsRepository();
    const strict = new ApplyPendingChangesUseCase({ lease, unitOfWork: store.unitOfWork, parser: new LibphonenumberParser(), settings: noCountry, clock });
    row("owner_numbers", "8888 0000");
    row("business_number", "8888 5555");
    expect(await strict.execute()).toEqual({ applied: 2 });
    expect(await numbers()).toEqual([`business ${BUSINESS}`]);
    expect(await store.repos.owners.log()).toEqual([]);
    const lines = log.mock.calls.map((c) => String(c[0]));
    log.mockRestore();
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.includes("needs_country_code"))).toBe(true);
  });

  test("a business number is parsed with no default country, even when a country is set", async () => {
    const log = stderr();
    row("business_number", "8888 5555"); // the country setting is NI, but a business number must carry its country code
    await apply.execute();
    expect(await numbers()).toEqual([`business ${BUSINESS}`]);
    expect(String(log.mock.calls[0]?.[0])).toContain("needs_country_code");
    log.mockRestore();
  });

  test("a row that has one unreadable number among several changes nothing at all", async () => {
    const log = stderr();
    row("owner_numbers", `${N2}, not-a-number`);
    expect(await apply.execute()).toEqual({ applied: 1 });
    log.mockRestore();
    expect(await numbers()).toEqual([`business ${BUSINESS}`]);
  });

  test("no pending rows: nothing applied, nothing written", async () => {
    expect(await apply.execute()).toEqual({ applied: 0 });
    expect(await store.repos.owners.log()).toEqual([]);
  });

  test("without the lease it returns refused, opens no transaction, and the rows stay unapplied", async () => {
    row("owner_numbers", N2);
    holder.token = "someone else";
    expect(await apply.execute()).toEqual({ refused: "not_owner" });
    let opened = 0;
    const counting = new ApplyPendingChangesUseCase({
      lease, unitOfWork: { run: (work) => (opened++, store.unitOfWork.run(work)) }, parser: new LibphonenumberParser(), settings, clock,
    });
    expect(await counting.execute()).toEqual({ refused: "not_owner" });
    expect(opened).toBe(0);
    holder.token = "me";
    expect(await unapplied()).toBe(1);
    expect(await numbers()).toEqual([`business ${BUSINESS}`]);
  });

  test("a lease lost between the check and the write is refused too, and nothing is applied", async () => {
    row("owner_numbers", N2);
    let first = true;
    const racing = new ApplyPendingChangesUseCase({
      lease: { isOwner: async () => true },
      unitOfWork: {
        run: async (work) => {
          if (first) {
            holder.token = "someone else";
            first = false;
          }
          return store.unitOfWork.run(work);
        },
      },
      parser: new LibphonenumberParser(),
      settings,
      clock,
    });
    expect(await racing.execute()).toEqual({ refused: "not_owner" });
    holder.token = "me";
    expect(await unapplied()).toBe(1);
  });

  test("the rows of one run are applied oldest first, so a later row sees the earlier one", async () => {
    row("owner_numbers", N2, "first", 1_000);
    row("owner_number_remove", N2, "second", 2_000);
    await apply.execute();
    expect(await numbers()).toEqual([`business ${BUSINESS}`]);
    expect((await store.repos.owners.log()).map((l) => `${l.action}:${l.command}`)).toEqual(["add:first", "remove:second"]);
  });
});

describe("DescribeNumber", () => {
  const describeNumber = () =>
    new DescribeNumberUseCase({ parser: new LibphonenumberParser(), owners: store.repos.owners, messages: store.repos.messages });

  test("FR-INTAKE-04-14: a local number with a default country shows its E.164, whether it is an owner number, and its customer messages", async () => {
    await put(from("c1", "+50588880001"), from("c2", "+50588880001"));
    const r = await describeNumber().execute({ raw: "8888 0001", defaultCountry: "NI" });
    expect(r).toEqual({ e164: "+50588880001", isOwnerNumber: false, customerMessages: 2 });
  });

  test("with no default country and no plus it asks for a country code; text that is no number is unparseable", async () => {
    expect(await describeNumber().execute({ raw: "8888 0000", defaultCountry: null })).toEqual({ invalid: "needs_country_code" });
    expect(await describeNumber().execute({ raw: "abc", defaultCountry: "NI" })).toEqual({ invalid: "unparseable" });
  });

  test("an owner number is recognized, and writes nothing", async () => {
    const r = await describeNumber().execute({ raw: "8888 0000", defaultCountry: "NI" });
    expect(r).toEqual({ e164: BUSINESS, isOwnerNumber: true, customerMessages: 0 });
    expect(await store.repos.owners.log()).toEqual([]);
  });
});

describe("GetOwnerNumbers", () => {
  const get = () => new GetOwnerNumbersUseCase(store.repos.owners);

  test("FR-INTAKE-04-1: numbers carry kind and label; the log carries the typed commands oldest first; without withLog there is no log", async () => {
    row("owner_numbers", N2, "first command", 1_000);
    await apply.execute();
    row("owner_numbers", `${N2}, ${N3}`, "second command", 2_000);
    await apply.execute();
    const view = await get().execute({ withLog: true });
    expect(view.numbers.map((n) => `${n.kind} ${n.number}`)).toEqual([`business ${BUSINESS}`, "extra +50588882222", "extra +50588883333"]);
    expect(view.log?.map((l) => l.command)).toEqual(["first command", "second command"]);
    expect("log" in (await get().execute({}))).toBe(false);
  });

  test("it asks no lease: a process that is not the owner can read", async () => {
    holder.token = "someone else";
    expect((await get().execute({ withLog: true })).numbers).toHaveLength(1);
  });
});

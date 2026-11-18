import type { Clock } from "../../shared/clock";
import type { Instant } from "../../shared/instant";
import type { OwnerLease } from "../../shared/owner-lease";
import type { PhoneNumber } from "../../shared/phone-number";
import type { OwnerNumberLogEntry, OwnerNumbers } from "../domain/owner-numbers";
import type { ApplyPendingChanges } from "../ports/apply-pending-changes";
import type { IntakeSettingsRepository } from "../ports/intake-settings-repository";
import { LeaseLostError, type IntakeUnitOfWork } from "../ports/intake-unit-of-work";
import type { PendingChange } from "../ports/pending-changes-reader";
import type { PhoneNumberParser } from "../ports/phone-number-parser";

export interface ApplyPendingChangesDeps {
  lease: OwnerLease;
  unitOfWork: IntakeUnitOfWork;
  parser: PhoneNumberParser;
  settings: Pick<IntakeSettingsRepository, "getCountry">;
  clock: Clock;
}

/**
 * Owner numbers change only through a pending-change row written from the owner's terminal, applied here under the
 * lease and logged with the typed command (L4). A stored message keeps its source: a change affects what arrives later.
 */
export class ApplyPendingChangesUseCase implements ApplyPendingChanges {
  constructor(private readonly d: ApplyPendingChangesDeps) {}

  async execute(): Promise<{ applied: number } | { refused: "not_owner" }> {
    if (!(await this.d.lease.isOwner())) return { refused: "not_owner" };
    const country = await this.d.settings.getCountry();
    try {
      return await this.d.unitOfWork.run(async (r) => {
        const rows = await r.pending.takeOwnerNumberChanges();
        const now = this.d.clock.now();
        const owners = await r.owners.load();
        const log: OwnerNumberLogEntry[] = [];
        for (const row of rows) this.apply(row, owners, country, now, log);
        await r.owners.save(owners, log);
        for (const row of rows) await r.pending.markApplied(row.id, now);
        return { applied: rows.length };
      });
    } catch (e) {
      if (e instanceof LeaseLostError) return { refused: "not_owner" };
      throw e;
    }
  }

  private apply(row: PendingChange, owners: OwnerNumbers, country: string | null, now: Instant, log: OwnerNumberLogEntry[]): void {
    const refuse = (why: string): void => console.error(`deputy: pending change ${row.id} (${row.key}) changed nothing: ${why}`);
    const add = (number: PhoneNumber, kind: "business" | "extra"): void => {
      if (owners.add({ number, kind, label: "", addedAt: now }).ok) {
        log.push({ at: now, action: "add", number: number.e164, kind, label: "", command: row.command });
      }
    };
    const remove = (number: PhoneNumber): void => {
      const entry = owners.entries().find((e) => e.number.sameLine(number));
      if (entry === undefined || !owners.remove(number).ok) return;
      log.push({ at: now, action: "remove", number: entry.number.e164, kind: entry.kind, label: entry.label, command: row.command });
    };

    if (row.key === "owner_numbers") {
      const wanted: PhoneNumber[] = [];
      for (const text of row.value.split(",").map((t) => t.trim()).filter((t) => t !== "")) {
        const parsed = this.d.parser.parse(text, country);
        if (!parsed.ok) return refuse(`a number could not be read (${parsed.invalid})`);
        wanted.push(parsed.number);
      }
      for (const entry of owners.entries().filter((e) => e.kind === "extra")) {
        if (!wanted.some((w) => w.sameLine(entry.number))) remove(entry.number);
      }
      for (const number of wanted) if (!owners.has(number)) add(number, "extra");
    } else if (row.key === "business_number") {
      if (row.value.trim() === "") return;
      const parsed = this.d.parser.parse(row.value.trim(), null);
      if (!parsed.ok) return refuse(`the number could not be read (${parsed.invalid})`);
      const current = owners.business();
      if (current?.number.sameLine(parsed.number)) return;
      if (current) remove(current.number);
      remove(parsed.number); // a number that was an extra becomes the business number
      add(parsed.number, "business");
    } else {
      const parsed = this.d.parser.parse(row.value.trim(), country);
      if (!parsed.ok) return refuse(`the number could not be read (${parsed.invalid})`);
      const entry = owners.entries().find((e) => e.number.sameLine(parsed.number));
      if (entry === undefined) return refuse("the number is not in the set");
      if (entry.kind === "business") return refuse("the business number changes only through its own command");
      remove(parsed.number);
    }
  }
}

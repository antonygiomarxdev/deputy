import { num, str } from "../../../adapters/sqlite/row";
import { PhoneNumber } from "../../../shared/phone-number";
import type { SqlDatabase, SqlRow } from "../../../shared/sql-database";
import {
  OwnerNumbers,
  type OwnerNumberEntry,
  type OwnerNumberKind,
  type OwnerNumberLogEntry,
} from "../../domain/owner-numbers";
import type { OwnerNumbersRepository } from "../../ports/owner-numbers-repository";

function kindOf(r: SqlRow): OwnerNumberKind {
  const k = str(r, "kind");
  if (k !== "business" && k !== "extra") throw new Error(`owner number kind '${k}'`);
  return k;
}

function phoneOf(r: SqlRow): PhoneNumber {
  const n = PhoneNumber.fromInternational(str(r, "number"));
  if (n === null) throw new Error("stored owner number is not a phone number");
  return n;
}

export class SqliteOwnerNumbersRepository implements OwnerNumbersRepository {
  constructor(private readonly db: SqlDatabase) {}

  async load(): Promise<OwnerNumbers> {
    const rows = await this.db.query("SELECT number, kind, label, added_at FROM owner_numbers ORDER BY added_at, number");
    const entries: OwnerNumberEntry[] = rows.map((r) => ({
      number: phoneOf(r),
      kind: kindOf(r),
      label: str(r, "label"),
      addedAt: num(r, "added_at"),
    }));
    return OwnerNumbers.of(entries);
  }

  async save(o: OwnerNumbers, log: readonly OwnerNumberLogEntry[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.run("DELETE FROM owner_numbers");
      for (const e of o.entries()) {
        await tx.run("INSERT INTO owner_numbers (number, kind, label, added_at) VALUES (?, ?, ?, ?)", [
          e.number.e164,
          e.kind,
          e.label,
          e.addedAt,
        ]);
      }
      for (const l of log) {
        await tx.run(
          "INSERT INTO owner_number_log (at, action, number, kind, label, command) VALUES (?, ?, ?, ?, ?, ?)",
          [l.at, l.action, l.number, l.kind, l.label, l.command],
        );
      }
    });
  }

  async log(): Promise<OwnerNumberLogEntry[]> {
    const rows = await this.db.query("SELECT at, action, number, kind, label, command FROM owner_number_log ORDER BY id");
    return rows.map((r) => {
      const action = str(r, "action");
      if (action !== "add" && action !== "remove") throw new Error(`owner number log action '${action}'`);
      return {
        at: num(r, "at"),
        action,
        number: str(r, "number"),
        kind: kindOf(r),
        label: str(r, "label"),
        command: str(r, "command"),
      };
    });
  }
}

export function createSqliteOwnerNumbersRepository(db: SqlDatabase): SqliteOwnerNumbersRepository {
  return new SqliteOwnerNumbersRepository(db);
}

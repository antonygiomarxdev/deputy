import { num, str } from "../../../adapters/sqlite/row";
import type { Instant } from "../../../shared/instant";
import type { SqlExecutor } from "../../../shared/sql-database";
import type { PendingChange, PendingChangesReader } from "../../ports/pending-changes-reader";

const KEYS = ["owner_numbers", "business_number", "owner_number_remove"] as const;

export class SqlitePendingChangesReader implements PendingChangesReader {
  constructor(private readonly ex: SqlExecutor) {}

  async takeOwnerNumberChanges(): Promise<PendingChange[]> {
    const rows = await this.ex.query(
      "SELECT id, key, value, command, at FROM pending_changes WHERE applied_at IS NULL AND key IN (?, ?, ?) ORDER BY at, id",
      [...KEYS],
    );
    return rows.map((r) => {
      const key = KEYS.find((k) => k === str(r, "key"));
      if (key === undefined) throw new Error("pending change with an unexpected key");
      return { id: num(r, "id"), key, value: str(r, "value"), command: str(r, "command"), at: num(r, "at") };
    });
  }

  async markApplied(id: number, at: Instant): Promise<void> {
    await this.ex.run("UPDATE pending_changes SET applied_at = ? WHERE id = ?", [at, id]);
  }
}

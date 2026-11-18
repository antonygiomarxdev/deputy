import type { Clock } from "../../shared/clock";
import { LEASE_TTL_MS } from "../../shared/lease-constants";
import type { LeaseControl } from "../../shared/owner-lease";
import type { SqlDatabase, SqlExecutor } from "../../shared/sql-database";
import { str } from "./row";

// Each step is one atomic statement, so two processes racing for an expired lease cannot both win.
export function createSqliteOwnerLease(db: SqlDatabase, clock: Clock, newToken: () => string): LeaseControl {
  const mine = newToken();

  const renew = async (): Promise<boolean> =>
    (await db.run("UPDATE lease SET heartbeat = ? WHERE id = 1 AND token = ?", [clock.now(), mine])).changes === 1;

  return {
    async isOwner(within?: SqlExecutor) {
      const [row] = await (within ?? db).query("SELECT token FROM lease WHERE id = 1");
      return row !== undefined && str(row, "token") === mine;
    },
    async tryAcquire() {
      const now = clock.now();
      const inserted = await db.run(
        "INSERT OR IGNORE INTO lease (id, token, holder_started, heartbeat) VALUES (1, ?, ?, ?)",
        [mine, now, now],
      );
      if (inserted.changes === 1) return true;
      if (await renew()) return true;
      // heartbeat 0 is a released lease; at exactly the TTL the lease has expired
      const taken = await db.run(
        "UPDATE lease SET token = ?, holder_started = ?, heartbeat = ? WHERE id = 1 AND token <> ? AND (heartbeat = 0 OR heartbeat <= ?)",
        [mine, now, now, mine, now - LEASE_TTL_MS],
      );
      return taken.changes === 1;
    },
    renew,
    async release() {
      await db.run("UPDATE lease SET heartbeat = 0 WHERE id = 1 AND token = ?", [mine]);
    },
  };
}

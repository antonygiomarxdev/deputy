// Child process of the two-process lease test: on each "go" line it takes a fresh lease token and prints whether it won.
import { openBunSqlite } from "../../src/adapters/sqlite/bun-sqlite-database";
import { createSqliteOwnerLease } from "../../src/adapters/sqlite/sqlite-owner-lease";
import { SystemClock } from "../../src/adapters/clock/system-clock";

const path = process.argv[2];
if (!path) throw new Error("usage: lease-worker <db path>");
const db = openBunSqlite({ path });
const clock = new SystemClock();

let buffer = "";
for await (const chunk of Bun.stdin.stream()) {
  buffer += new TextDecoder().decode(chunk);
  let nl: number;
  while ((nl = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, nl);
    buffer = buffer.slice(nl + 1);
    if (line === "go") {
      const won = await createSqliteOwnerLease(db, clock, () => crypto.randomUUID()).tryAcquire();
      process.stdout.write(`${won}\n`);
    }
  }
}
db.close();

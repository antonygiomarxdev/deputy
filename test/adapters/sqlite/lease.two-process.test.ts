import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openBunSqlite } from "../../../src/adapters/sqlite/bun-sqlite-database";
import { migrate } from "../../../src/adapters/sqlite/migrate";

const ROUNDS = 40;
const worker = join(import.meta.dir, "../../support/lease-worker.ts");

function lineReader(stream: ReadableStream<Uint8Array>): () => Promise<string> {
  const reader = stream.getReader();
  let buffer = "";
  return async () => {
    for (;;) {
      const nl = buffer.indexOf("\n");
      if (nl >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        return line;
      }
      const { value, done } = await reader.read();
      if (done) throw new Error("worker closed its stdout");
      buffer += new TextDecoder().decode(value);
    }
  };
}

test("two real processes racing for a free lease: exactly one wins each round", async () => {
  const dir = mkdtempSync(join(tmpdir(), "deputy-lease2-"));
  const path = join(dir, "deputy.db");
  const sql = await Bun.file(join(import.meta.dir, "../../../src/adapters/sqlite/migrations/0001-shared.sql")).text();
  const db = openBunSqlite({ path });
  await migrate(db, [{ name: "0001", sql }], { basePath: path, copyTo: async () => {} });

  const procs = [0, 1].map(() =>
    Bun.spawn([process.execPath, worker, path], { stdin: "pipe", stdout: "pipe", stderr: "inherit" }),
  );
  const readers = procs.map((p) => lineReader(p.stdout));
  try {
    for (let round = 0; round < ROUNDS; round++) {
      await db.run("DELETE FROM lease");
      for (const p of procs) {
        p.stdin.write("go\n");
        p.stdin.flush();
      }
      const answers = await Promise.all(readers.map((read) => read()));
      expect(answers.filter((a) => a === "true"), `round ${round}: ${answers.join(",")}`).toHaveLength(1);
    }
  } finally {
    for (const p of procs) p.kill(); // only the two PIDs started here
    await Promise.all(procs.map((p) => p.exited));
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}, 60_000);

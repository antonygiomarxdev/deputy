// covers: intake/FRD-04/EX-21
// covers: intake/FRD-04/EX-22
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { openSqliteSubject } from "../../support/intake-subjects";

describe("PendingChangesReader (sqlite)", () => {
  let s: Awaited<ReturnType<typeof openSqliteSubject>>;
  beforeEach(async () => {
    s = await openSqliteSubject();
  });
  afterEach(() => s.cleanup());

  const add = (key: string, value: string, at: number) =>
    s.db.run("INSERT INTO pending_changes (key, value, command, at) VALUES (?, ?, ?, ?)", [key, value, `deputy config ${key} ${value}`, at]);

  test("FR-INTAKE-04-9: only the three keys' unapplied rows come, oldest first, and an applied row does not come again", async () => {
    await add("business_number", "+12125550100", 300);
    await add("owner_numbers", "+12125550102", 100);
    await add("time_zone", "America/Chicago", 50);
    await add("owner_number_remove", "+12125550108", 200);

    const taken = await s.repos.pending.takeOwnerNumberChanges();
    expect(taken.map((c) => c.key)).toEqual(["owner_numbers", "owner_number_remove", "business_number"]);
    expect(taken[0]).toMatchObject({ value: "+12125550102", command: "deputy config owner_numbers +12125550102", at: 100 });

    await s.repos.pending.markApplied(taken[0]?.id ?? 0, 900);
    expect((await s.repos.pending.takeOwnerNumberChanges()).map((c) => c.key)).toEqual(["owner_number_remove", "business_number"]);
    const [row] = await s.db.query("SELECT applied_at FROM pending_changes WHERE id = ?", [taken[0]?.id ?? 0]);
    expect(row?.["applied_at"]).toBe(900);
  });

  test("nothing pending gives an empty list", async () => {
    expect(await s.repos.pending.takeOwnerNumberChanges()).toEqual([]);
  });
});

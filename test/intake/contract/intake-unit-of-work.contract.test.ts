import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { LeaseLostError } from "../../../src/intake/ports/intake-unit-of-work";
import { receive } from "../../support/intake-fixtures";
import { openSqliteSubject, subjects, type IntakeSubject } from "../../support/intake-subjects";

for (const subject of subjects) {
  describe(`IntakeUnitOfWork (${subject.name})`, () => {
    let s: IntakeSubject;
    beforeEach(async () => {
      s = await subject.open();
    });
    afterEach(() => s.cleanup());

    test("work that inserts a message and then throws stores nothing", async () => {
      await expect(
        s.unitOfWork.run(async (r) => {
          await r.messages.insertIfNew(receive());
          await r.rejections.add(1, "malformed", false);
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");
      expect(await s.repos.messages.find({ provider: "kapso", providerMessageId: "m1" })).toBeNull();
      expect((await s.repos.rejections.list()).notes).toHaveLength(0);
    });

    test("committed work is visible", async () => {
      await s.unitOfWork.run((r) => r.messages.insertIfNew(receive()));
      expect(await s.repos.messages.find({ provider: "kapso", providerMessageId: "m1" })).not.toBeNull();
    });

    test("owner numbers can be read inside the unit of work", async () => {
      const owners = await s.unitOfWork.run((r) => r.owners.load());
      expect(owners.entries()).toHaveLength(0);
    });
  });
}

test("SQLite: a lease that is not ours throws LeaseLostError and the work does not run", async () => {
  const s = await openSqliteSubject({ isOwner: async () => false });
  let ran = false;
  await expect(
    s.unitOfWork.run(async () => {
      ran = true;
    }),
  ).rejects.toBeInstanceOf(LeaseLostError);
  expect(ran).toBe(false);
  s.cleanup();
});

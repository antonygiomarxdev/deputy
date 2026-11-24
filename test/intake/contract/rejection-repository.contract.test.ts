import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { REJECTION_MAX_AGE_MS } from "../../../src/intake/ports/rejection-repository";
import { subjects, type IntakeSubject } from "../../support/intake-subjects";

const DAY = 24 * 60 * 60 * 1000;

for (const subject of subjects) {
  describe(`RejectionRepository (${subject.name})`, () => {
    let s: IntakeSubject;
    beforeEach(async () => {
      s = await subject.open();
    });
    afterEach(() => s.cleanup());

    // 600 adds are about 2400 fsyncs on Windows, so the 5 s default is not enough under load
    test("600 notes leave 500 and count 100 pruned", async () => {
      for (let i = 0; i < 600; i++) await s.repos.rejections.add(1_000 + i, "bad_signature", false);
      const { notes, prunedCount } = await s.repos.rejections.list();
      expect(notes).toHaveLength(500);
      expect(prunedCount).toBe(100);
      expect(notes[0]?.at).toBe(1_599);
    }, 30_000);

    test("a note older than 30 days is pruned at the next add", async () => {
      await s.repos.rejections.add(1_000, "malformed", false);
      await s.repos.rejections.add(1_000 + REJECTION_MAX_AGE_MS + DAY, "malformed", false);
      const { notes, prunedCount } = await s.repos.rejections.list();
      expect(notes).toHaveLength(1);
      expect(prunedCount).toBe(1);
    });

    test("a recoverable note stays unrecovered until a run that started after it", async () => {
      await s.repos.rejections.add(100, "no_identifier", true);
      expect((await s.repos.rejections.list()).unrecovered).toBe(1);
      await s.repos.rejections.resolveRecoverableBefore(50, 300);
      expect((await s.repos.rejections.list()).unrecovered).toBe(1);
      await s.repos.rejections.resolveRecoverableBefore(200, 300);
      const { notes, unrecovered } = await s.repos.rejections.list();
      expect(unrecovered).toBe(0);
      expect(notes[0]).toEqual({ at: 100, reason: "no_identifier", recoverable: true, resolvedAt: 300 });
    });

    test("a note has no field other than time, reason, recoverable and resolved", async () => {
      await s.repos.rejections.add(1, "no_secret", false);
      const note = (await s.repos.rejections.list()).notes[0];
      expect(Object.keys(note ?? {}).sort()).toEqual(["at", "reason", "recoverable", "resolvedAt"]);
    });

    test("sync state: live verification creates the row, connectedAt is null before catch-up", async () => {
      expect(await s.repos.syncState.liveVerifiedAt("kapso")).toBeNull();
      expect(await s.repos.syncState.connectedAt("kapso")).toBeNull();
      await s.repos.syncState.markLiveVerified("kapso", 777);
      expect(await s.repos.syncState.liveVerifiedAt("kapso")).toBe(777);
      expect(await s.repos.syncState.liveVerifiedAt("dev")).toBeNull();
      expect(await s.repos.syncState.connectedAt("kapso")).toBeNull();
    });
  });
}

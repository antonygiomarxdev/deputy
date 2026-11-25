// covers: intake/FRD-03/EX-37
// covers: intake/FRD-03/EX-38
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { subjects, type IntakeSubject } from "../../support/intake-subjects";

for (const subject of subjects) {
  describe(`IntakeSettingsRepository (${subject.name})`, () => {
    let s: IntakeSubject;
    beforeEach(async () => {
      s = await subject.open();
    });
    afterEach(() => s.cleanup());

    test("FR-INTAKE-03-21: the catch-up period defaults to 2 and keeps what was set", async () => {
      expect(await s.settings.getCatchUpMinutes()).toBe(2);
      await s.settings.setCatchUpMinutes(5, 1_234);
      expect(await s.settings.getCatchUpMinutes()).toBe(5);
      expect(await s.settingChangedAt("catch_up_minutes")).toBe(1_234);
      await s.settings.setCatchUpMinutes(3, 2_000);
      expect(await s.settings.getCatchUpMinutes()).toBe(3);
      expect(await s.settingChangedAt("catch_up_minutes")).toBe(2_000);
    });

    test("the country is null until set", async () => {
      expect(await s.settings.getCountry()).toBeNull();
      await s.settings.setCountry("AR", 10);
      expect(await s.settings.getCountry()).toBe("AR");
      expect(await s.settingChangedAt("country")).toBe(10);
    });
  });
}

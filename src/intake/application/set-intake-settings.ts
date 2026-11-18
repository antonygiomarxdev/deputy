import type { Clock } from "../../shared/clock";
import type { OwnerLease } from "../../shared/owner-lease";
import { MIN_PERIOD_MINUTES } from "../domain/constants";
import type { IntakeSettingsRepository } from "../ports/intake-settings-repository";
import type { PhoneNumberParser } from "../ports/phone-number-parser";
import type { SetIntakeSettings } from "../ports/set-intake-settings";

export interface SetIntakeSettingsDeps {
  settings: IntakeSettingsRepository;
  lease: OwnerLease;
  parser: PhoneNumberParser;
  clock: Clock;
}

type Request = Parameters<SetIntakeSettings["execute"]>[0];
type Result = Awaited<ReturnType<SetIntakeSettings["execute"]>>;

/** The owner's words are the proof the owner asked for it; Intake keeps no settings log, so they are not stored. */
export class SetIntakeSettingsUseCase implements SetIntakeSettings {
  constructor(private readonly d: SetIntakeSettingsDeps) {}

  async execute(q: Request): Promise<Result> {
    if (!(await this.d.lease.isOwner())) return { ok: false, reason: "not_owner" };
    const now = this.d.clock.now();
    if (q.key === "country") {
      if (!this.d.parser.isCountry(q.value)) return { ok: false, reason: "unknown_country", kept: await this.d.settings.getCountry() };
      await this.d.settings.setCountry(q.value, now);
      return { ok: true, value: q.value };
    }
    if (!Number.isInteger(q.value)) {
      return { ok: false, reason: "not_an_integer", minimum: MIN_PERIOD_MINUTES, kept: await this.d.settings.getCatchUpMinutes() };
    }
    if (q.value < MIN_PERIOD_MINUTES) {
      return { ok: false, reason: "below_minimum", minimum: MIN_PERIOD_MINUTES, kept: await this.d.settings.getCatchUpMinutes() };
    }
    await this.d.settings.setCatchUpMinutes(q.value, now);
    return { ok: true, value: q.value };
  }
}

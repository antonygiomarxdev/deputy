import type { OwnerWords } from "../../shared/owner-words";

export interface SetIntakeSettings {
  execute(
    q:
      | { key: "catch_up_minutes"; value: number; ownerWords: OwnerWords }
      | { key: "country"; value: string; ownerWords: OwnerWords },
  ): Promise<
    | { ok: true; value: number | string }
    | { ok: false; reason: "not_owner" }
    | { ok: false; reason: "below_minimum" | "not_an_integer"; minimum: 1; kept: number }
    | { ok: false; reason: "unknown_country"; kept: string | null }
  >;
}

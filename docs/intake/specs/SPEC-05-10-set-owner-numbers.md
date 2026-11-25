# SPEC-05-10: Add an owner number after the owner's words and a confirmation

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

The use case `SetOwnerNumbers`: the first call parses the number with the owner's country as the default region, writes nothing and returns the E.164 form, whether it is already an owner number and its customer message count. The second call, with the confirmation, adds the number and logs it with the owner's words. It only adds, never removes, never changes the business number, and needs the lease.

Last change: 2026-11-24, first draft from FRD-05

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-17 | WHEN | When the session calls set_owner_numbers with a number and the owner's words, Intake shall parse the number with the owner's country as the default region (ADR-012), write nothing, and return the E.164 form, whether it is already an owner number, and how many customer messages came from it. |
| FR-INTAKE-05-18 | WHEN | When the session repeats the call with the confirmation after the owner agreed to the E.164 form, Intake shall add the number as an owner number and log the change with the owner's words. |
| FR-INTAKE-05-19 | IF | If the number cannot be parsed or needs a country code, Intake shall refuse with the reason and write nothing. |
| FR-INTAKE-05-20 | IF | If this process does not hold the lease, Intake shall refuse and write nothing. |
| FR-INTAKE-05-21 | always | set_owner_numbers shall add numbers only. It shall never remove a number and never change the business number. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/ports/set-owner-numbers.ts` | Create | the `SetOwnerNumbers` port and its results |
| `src/intake/application/set-owner-numbers.ts` | Create | `SetOwnerNumbersUseCase` |
| `test/intake/unit/set-owner-numbers.test.ts` | Create | the tests below |

## Reuses
- `src/intake/application/describe-number.ts` `DescribeNumberUseCase`: returns the E.164 form, `isOwnerNumber` and `customerMessages`
- `src/intake/application/apply-pending-changes.ts` `ApplyPendingChangesUseCase`: the add and the `OwnerNumberLogEntry` it writes
- `src/intake/ports/phone-number-parser.ts` `PhoneNumberParser`: the country default and the refusal codes
- `src/intake/ports/intake-settings-repository.ts` `IntakeSettingsRepository`: `getCountry`

## Tests first
FR-INTAKE-05-17, FR-INTAKE-05-18, FR-INTAKE-05-19, FR-INTAKE-05-20, FR-INTAKE-05-21, written before the code, without it in view, with the in-memory fakes. FR-INTAKE-05-17: with the country US, `212 555 0100` returns `+12125550100`, `isOwnerNumber` false and the customer message count, and the owner numbers are unchanged. FR-INTAKE-05-18: the same call with the confirmation adds the number as kind `extra`, and the log holds one entry with the owner's words; a repeat adds nothing and logs nothing. FR-INTAKE-05-19: an unparseable number and a number that needs a country code, with no country set, are refused with the parser's reason and nothing is written. FR-INTAKE-05-20: a process without the lease is refused and nothing is written. FR-INTAKE-05-21: no call removes a number, and a number equal to the business number is refused as already an owner number, so the business number is unchanged.

## Build
```ts
export type SetOwnerNumbersResult =
  | { kind: "described"; e164: string; isOwnerNumber: boolean; customerMessages: number }
  | { kind: "added"; e164: string }
  | { kind: "refused"; reason: "unparseable" | "needs_country_code" | "not_owner" };
export interface SetOwnerNumbers { execute(q: { raw: string; ownerWords: string; confirm: boolean }): Promise<SetOwnerNumbersResult> }
```
The owner's words are required and stored in the log entry's `command` field with the prefix `owner said:`.

## Done when
`bun test test/intake/unit/set-owner-numbers.test.ts`

## Out of scope
The tool (SPEC-05-11). Removing a number (FR-INTAKE-05-23: deferred until after the pilot, nothing to build) and setting the business number by hand (the open question of FRD-05).

## Open questions
None.

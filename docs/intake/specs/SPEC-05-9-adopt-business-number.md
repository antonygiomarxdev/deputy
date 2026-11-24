# SPEC-05-9: Record the business number from the provider at start

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

A use case `AdoptBusinessNumber`, called once by `serve` after the provider is chosen: when no business number is recorded and the provider offers one, it records it as the business number and logs it like an owner-number change with the command "provider". When the provider offers none, it says so, and nothing is written. No SQL and no terminal for a new owner.

Last change: 2026-11-24, first draft from FRD-05; replaces the SQL step of task 215

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-15 | WHEN | When Deputy starts with the Kapso provider and no business number is recorded, Intake asks the provider for the connected number and records it as the business number, logged like an owner-number change with the command "provider". |
| FR-INTAKE-05-16 | IF | If the provider offers no business number, Intake tells the session that the business number is missing, so the session asks the owner. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/application/adopt-business-number.ts` | Create | `AdoptBusinessNumberUseCase` |
| `src/main/serve.ts` | Change | calls it after `chooseProvider`, under the lease |
| `test/intake/unit/adopt-business-number.test.ts` | Create | the tests below |

## Reuses
- `src/intake/application/check-provider-access.ts` `CheckProviderAccessUseCase`: already asks the provider for the business number
- `src/intake/application/apply-pending-changes.ts` `ApplyPendingChangesUseCase`: the add-and-log code (`OwnerNumberLogEntry` with the typed command) this use case follows
- `src/intake/ports/owner-numbers-repository.ts` `OwnerNumbersRepository`: loads and saves the owner numbers with their log
- `src/main/serve.ts` `serve`: the start order, where the call goes

## Tests first
FR-INTAKE-05-15, FR-INTAKE-05-16, written before the code, without it in view, with a fake provider. FR-INTAKE-05-15: with no business number recorded and the provider offering `+50588881111`, the number is recorded with kind `business` and one log entry whose command is "provider"; with one already recorded nothing changes and the provider is not asked; run twice, it records once. FR-INTAKE-05-16: with the provider offering none, nothing is written and the result is `missing`, which the session reads from the status. A provider error leaves everything unchanged and the result names the error kind.

## Build
```ts
export type AdoptResult = { kind: "recorded"; e164: string } | { kind: "already_recorded" } | { kind: "missing" } | { kind: "provider_error"; error: ProviderErrorKind };
export interface AdoptBusinessNumber { execute(): Promise<AdoptResult> }
```
`serve` calls `execute` after `applyPendingChanges` and before the provider settings are resolved, because `ResolveProviderSettings` refuses a missing business number today. Only the owner process calls it.

## Done when
`bun test test/intake/unit/adopt-business-number.test.ts`

## Out of scope
Telling the owner what to do when the number is missing (Setup, the skill). Giving the number by hand when the provider offers none: the open question of FRD-05.

## Open questions
None.

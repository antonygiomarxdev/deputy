# SPEC-08-7: `ApplyPendingChanges` adds the numbers of an `owner_numbers` row

Status: Draft
Rests on: ../../intake/tp/TP-04-owner-echoes.md

## Summary

TD-8 in `docs/tp/TP.md` says "an add through `set`, a removal through `remove`". Today `ApplyPendingChanges` reads the value of an `owner_numbers` row as the whole list of extra numbers and removes the extras that are not in it. This spec changes that branch to add the numbers of the row and remove nothing.

Last change: 2026-11-24, first draft, from the lead's answer on `set owner-numbers`

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-04-9 | Given messages from a staff number were stored as `customer`, When the owner adds that number and `ApplyPendingChanges` runs, Then old messages keep `customer` and new ones are `owner_app`; the log has one `add` row with the typed command | UC |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/application/apply-pending-changes.ts` | Change | the `owner_numbers` branch: add each number, remove none |
| `test/intake/acceptance/owner-number-commands.test.ts` | Change | the tests below |

## Reuses
- `src/intake/application/apply-pending-changes.ts` `ApplyPendingChangesUseCase`: the use case this spec changes; its `add`, `refuse` and log code stay
- `test/intake/acceptance/owner-number-commands.test.ts` `ApplyPendingChangesUseCase`: the acceptance test that already drives it

## Tests first
FR-INTAKE-04-9, written before the code, without it in view: (1) given extra number A is set, when an `owner_numbers` row with number B is applied, then A and B are both owner numbers and the log has one `add` row for B with the typed command; (2) a row whose number is already set adds nothing and logs nothing; (3) an unreadable number in the row changes nothing and is refused as today; (4) the business number is untouched. The existing test whose title says an owner_numbers row "adds the missing numbers and removes the absent extra" is changed to expect the absent extra to stay; the sequence of two commands in the same file (a second row with two numbers) is checked against the new behavior.

## Build
In the `owner_numbers` branch of `apply`, delete the loop that removes extras not in `wanted`. Keep the parse, the refusal and the add loop. No signature changes.

## Done when
`bun test test/intake/acceptance/owner-number-commands.test.ts`

## Out of scope
The command that writes the row (SPEC-08-2). Removal stays `owner_number_remove`.

## Open questions
None.

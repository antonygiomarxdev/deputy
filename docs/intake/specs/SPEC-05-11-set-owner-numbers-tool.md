# SPEC-05-11: The set_owner_numbers tool

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

Registers `set_owner_numbers`: the first call shows the owner the E.164 form back, the second, with `confirm`, adds the number. The tool text tells the session to pass the owner's own words and to ask for the confirmation first.

Last change: 2026-11-24, first draft from FRD-05

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-17 | WHEN | When the session calls set_owner_numbers with a number and the owner's words, Intake parses the number with the owner's country as the default region (ADR-012), writes nothing, and returns the E.164 form, whether it is already an owner number and how many customer messages came from it. |
| FR-INTAKE-05-18 | WHEN | When the session repeats the call with the confirmation after the owner agreed to the E.164 form, Intake adds the number as an owner number and logs the change with the owner's words. |
| FR-INTAKE-05-20 | IF | If this process does not hold the lease, Intake refuses and writes nothing. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/intake/adapters/mcp/intake-tools.ts` | Change | the `set_owner_numbers` tool |
| `src/main/tools.ts` | Change | passes `setOwnerNumbers` to `intakeTools` |
| `test/intake/unit/set-owner-numbers-tool.test.ts` | Create | the tests below |

## Reuses
- `src/intake/adapters/mcp/intake-tools.ts` `intakeTools`: where `list_owner_numbers` already sits next to it
- `src/main/tools.ts` `mcpServer`: the tool list the server offers
- Precedent: SPEC-05-10-set-owner-numbers.md, the use case and its results

## Tests first
FR-INTAKE-05-17, FR-INTAKE-05-18, FR-INTAKE-05-20, written before the code, without it in view, through the tool definitions with a fake use case. FR-INTAKE-05-17: a call with `number` and `ownerWords` and no `confirm` returns the E.164 form, whether it is an owner number and the customer message count, and tells the session to show it to the owner. FR-INTAKE-05-18: a call with `confirm: true` returns the added form. FR-INTAKE-05-20: a `not_owner` refusal is an error result with a plain sentence; the tool description says the owner's words must be the owner's, never customer text.

## Build
```ts
// tool "set_owner_numbers": input { number: string, ownerWords: string, confirm?: boolean }
// output: { e164, isOwnerNumber, customerMessages } or { added: e164 }
```

## Done when
`bun test test/intake/unit/set-owner-numbers-tool.test.ts`

## Out of scope
The use case (SPEC-05-10). Reading the numbers back is `list_owner_numbers`, built.

## Open questions
None.

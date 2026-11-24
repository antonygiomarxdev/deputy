# SPEC-05-12: The OwnerAnswered signal

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

The signal Intake hands to Drafts when a question is closed with an answer: the question id, the customer chat and the text, as `OwnerAnswered` in `src/shared/signals.ts`, added to the `IntakeEvent` union. Its fields match Drafts' `OwnerAnswer` (`{ questionId: string; text: string }`, now with `chatId: string`) plus the time. Nothing publishes it yet (SPEC-05-7).

Last change: 2026-11-24, first draft

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-22 | WHEN | When Intake closes a question with an answer, it hands Drafts the question id, the customer chat the question names and the text. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/shared/signals.ts` | Change | the `OwnerAnswered` interface |
| `src/intake/domain/events.ts` | Change | adds it to `IntakeEvent` |
| `test/intake/unit/owner-answered-signal.test.ts` | Create | the tests below |

## Reuses
- `src/shared/signals.ts` `OwnerReplyUnlinked`: the signal Intake already publishes, the shape to follow
- `src/intake/domain/events.ts` `IntakeEvent`: the union the publisher accepts

## Tests first
FR-INTAKE-05-22, written before the code, without it in view. FR-INTAKE-05-22: a value `{ name: "OwnerAnswered", questionId: "7", chatId: "chat-1", text: "yes", at }` is accepted as an `IntakeEvent` (a compile-time check with `satisfies`, run by `bun test`); `questionId`, `chatId` and `text` are strings; the event name is the literal `"OwnerAnswered"`; the shared kernel file still imports nothing but `./instant`.

## Build
```ts
/** Intake publishes it when a question is closed with an answer; Drafts takes it as the go for that answer. */
export interface OwnerAnswered { readonly name: "OwnerAnswered"; readonly questionId: string; readonly chatId: string; readonly text: string; readonly at: Instant }
// events.ts: export type IntakeEvent = MessageStored | OwnerReplyUnlinked | OwnerAnswered | CatchUpFinished;
```

## Done when
`bun test test/intake/unit/owner-answered-signal.test.ts`

## Out of scope
Publishing it (SPEC-05-7); what Drafts does with it.

## Open questions
None.

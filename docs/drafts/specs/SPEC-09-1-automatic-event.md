# SPEC-09-1: the automatic flag on the sent event

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

Adds `automatic` to the `DraftSent` event and sets it from the send decision, so a send the gate allowed without a go is marked automatic (R-DRAFTS-22). First of three: 09-2 maps it to the entry, 09-3 stores it.

Last change: 2026-11-24, rewritten after review of PR 202 (SPEC-09 split into 09-1 to 09-3; SPEC-07 takes the go from Intake's OwnerAnswered).

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-11 | always | Each automatic send shall be logged as automatic, with its draft and time. (R-DRAFTS-22) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/domain/events.ts | Change | `DraftSent` gains `automatic: boolean` |
| src/drafts/domain/draft.ts | Change | The send emits `DraftSent` with `automatic` from the send decision; default false |
| test/drafts/auto-event.test.ts | Create | The tests for FR-DRAFTS-04-11, event part |

## Reuses
- Precedent: SPEC-01-draft-lifecycle.md, which defines `DraftSent`; this spec adds one field to it.

## Tests first
- FR-DRAFTS-04-11 (1): given an automatic send, the `DraftSent` event has `automatic: true`.
- FR-DRAFTS-04-11 (2): given a send the owner approved by hand, `automatic` is false.
- FR-DRAFTS-04-11 (3): given no value for `automatic`, the event has `automatic: false`.

## Build
```ts
export type DraftSent = { /* existing fields */ automatic: boolean };
```

## Done when
`bun test test/drafts/auto-event.test.ts`

## Out of scope
The log entry and mapper (SPEC-09-2), the column and its migration (SPEC-09-3), the send decision (SPEC-05).

## Open questions
None.

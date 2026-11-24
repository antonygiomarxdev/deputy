# SPEC-06: the window check for an automatic first send

Status: Draft
Rests on: ../frd/FRD-03-safe-send.md

## Summary

Checks the customer's 24 hour window before an automatic first send, as ADR-012 does for a retry. A closed window sends nothing and sets `tellOwner`, so the caller tells the owner (R-DRAFTS-22). Depends on SPEC-03, which creates `CUSTOMER_WINDOW_MS`.

Last change: 2026-11-24, rewritten after review of PR 202 (SPEC-09 split into 09-1 to 09-3; SPEC-07 takes the go from Intake's OwnerAnswered).

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-03-14 | WHEN | When an automatic answer is ready and the customer's 24 hour window is closed, Deputy shall not send and shall tell the owner, as ADR-012 does for a retry. (R-DRAFTS-22) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/domain/first-send-window.ts | Create | The window check for a first automatic send |
| test/drafts/first-send-window.test.ts | Create | The tests for FR-DRAFTS-03-14 |

## Reuses
- Precedent: SPEC-03-safe-send.md, which creates `CUSTOMER_WINDOW_MS` in `src/drafts/domain/constants.ts`; this spec imports that constant and does not redefine it.

## Tests first
- FR-DRAFTS-03-14 (1): given the latest customer message 1 hour before now, `checkFirstSend` returns `send: true`.
- FR-DRAFTS-03-14 (2): given the latest customer message 25 hours before now, it returns `send: false`, reason `window_closed`, `tellOwner: true`.
- FR-DRAFTS-03-14 (3): given no customer message (null), it returns the same closed result as (2).

## Build
```ts
export type FirstSendCheck = { send: true } | { send: false; reason: "window_closed"; tellOwner: true };
export function checkFirstSend(latestCustomerSentAt: number | null, now: number): FirstSendCheck;
```

## Done when
`bun test test/drafts/first-send-window.test.ts`

## Out of scope
The retry window case (SPEC-03) and the owner's notice text (set by the caller, not here).

## Open questions
None.

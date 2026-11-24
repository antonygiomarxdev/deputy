# Spec: the window check for an automatic first send (Drafts FRD-03)

Status: Draft

## Summary

Checks the customer's 24 hour window before an automatic first send, as ADR-012 does for a retry. A closed window sends nothing and tells the owner. It reuses `CUSTOMER_WINDOW_MS` from SPEC-03, which creates it.

Last change: 2026-11-24, new spec for the local pilot (REQ-15, D31, D38).

## Context

Builds these rows of [FRD-03-safe-send.md](../frd/FRD-03-safe-send.md):

| FR-DRAFTS-03-14 | WHEN | When an automatic answer is ready and the customer's 24 hour window is closed, Deputy shall not send and shall tell the owner, as ADR-012 does for a retry. (R-DRAFTS-22) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/domain/first-send-window.ts | Create | The window check for a first automatic send |
| test/drafts/first-send-window.test.ts | Create | Tests for FR-DRAFTS-03-14 |

## Interfaces

```ts
export function checkFirstSend(latestCustomerSentAt: number | null, now: number): { send: true } | { send: false; reason: "window_closed" };
```

## Data

None: this spec adds no stored data beyond the log entry it marks.

## Tasks

### Task 1: The window check for a first send
- **Tests first:** `bun test test/drafts/first-send-window.test.ts`, written before the code, one test per row above.
- **Done when:** `bun test test/drafts/first-send-window.test.ts` passes.

## Out of scope
The retry window case, which SPEC-03-safe-send.md already covers.

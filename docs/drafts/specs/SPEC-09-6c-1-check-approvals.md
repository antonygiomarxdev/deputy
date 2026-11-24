# SPEC-09-6c-1: CheckApprovalsUseCase reports an automatic send as automatic

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

`CheckApprovalsUseCase.run()` lists an automatic send under `automatic`, not as a defect and not as an owner approval (R-DRAFTS-17), reading the basis of the approved entry (depends on SPEC-09-6a-2).

Last change: 2026-11-24, split so each run has at most three files, test files included.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-5 | always | A sent message with no approval entry is a defect. The owner can check by asking the agent, "does every sent message have an approval?" Deputy shall list any sent entry that lacks one, or say there is none. An automatic approval keeps empty owner words and basis automatic; Deputy reports it as automatic, not as an owner approval, and the log shows each approval's basis. (R-DRAFTS-17) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/application/check-approvals.ts | Change | `CheckApprovalsUseCase.run()` returns the `automatic` list |
| src/drafts/domain/approval-audit.ts | Change | `ApprovalAudit` classifies an approved entry by its basis and reports no defect for `automatic` |
| test/drafts/check-approvals-automatic.test.ts | Create | The tests below |

## Reuses
- Precedent: SPEC-04-drafts-log.md Task 4, which built `CheckApprovalsUseCase` and `ApprovalAudit`.

## Tests first
- FR-DRAFTS-04-5 (7): a sent entry whose approved entry has basis `automatic` is listed under `automatic` by `CheckApprovalsUseCase.run()`, with no defect.
- FR-DRAFTS-04-5 (8): a sent entry whose approved entry has basis `owner_words` gives the same result as before.

## Build
```ts
// CheckApprovalsUseCase.run(): Promise<{ defects: Defect[]; gaps: Gap[]; automatic: { entryId: number; draft: number; chat: string }[] }>
```

## Done when
`bun test test/drafts/check-approvals-automatic.test.ts`

## Out of scope
The log read (SPEC-09-6c-2) and the approval method (SPEC-09-4).

## Open questions
None.

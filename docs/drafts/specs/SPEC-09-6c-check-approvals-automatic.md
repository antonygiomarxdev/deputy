# SPEC-09-6c: CheckApprovals reports an automatic send, and the log read shows the basis

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

`CheckApprovalsUseCase.run()` lists an automatic send under `automatic`, not as a defect and not as an owner approval (R-DRAFTS-17). `ApprovalAudit` reads the basis of the approved entry. The log read shows the approved and sent entries with their basis, so an owner_go send is verifiable (PRODUCT section 8, criterion 2). Depends on SPEC-09-6b.

Last change: 2026-11-24, after the review of 7a56758: the approved entry carries the basis; CheckApprovals runs on the real use case; the approval port gains approvalsBetween. Split so each run has at most 3 files.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-5 | always | A sent message with no approval entry is a defect. The owner can check by asking the agent, "does every sent message have an approval?" Deputy shall list any sent entry that lacks one, or say there is none. An automatic approval keeps empty owner words and basis automatic; Deputy reports it as automatic, not as an owner approval, and the log shows each approval's basis. (R-DRAFTS-17) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/application/check-approvals.ts | Change | `CheckApprovalsUseCase.run()` returns the `automatic` list from the approved entries' basis |
| src/drafts/domain/approval-audit.ts | Change | `ApprovalAudit` classifies an approved entry by its basis, and reports no defect for `automatic` |
| src/drafts/application/read-draft-log.ts | Change | Each approved and sent entry in the read shows its basis |

## Reuses
- Precedent: SPEC-04-drafts-log.md Task 4, which built `CheckApprovalsUseCase` and `ApprovalAudit`.

## Tests first
- FR-DRAFTS-04-5 (7): given a sent entry whose approved entry has basis `automatic`, `CheckApprovalsUseCase.run()` lists it under `automatic` and reports no defect for it.
- FR-DRAFTS-04-5 (8): given a sent entry whose approved entry has basis `owner_words`, the result is unchanged from before.
- FR-DRAFTS-04-5 (9): given an owner_go send, the log read shows its approved entry with basis `owner_go`.

## Build
```ts
// CheckApprovalsUseCase.run(): Promise<{ defects: Defect[]; gaps: Gap[]; automatic: { entryId: number; draft: number; chat: string }[] }>
```

## Done when
`bun test test/drafts/check-approvals-automatic.test.ts`

## Out of scope
The approval method (SPEC-09-4), the basis column (SPEC-09-6b), and the approval reads (SPEC-09-5b, 09-5b-2).

## Open questions
None.

# SPEC-09-6: CheckApprovals reports an automatic send as automatic

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

CheckApprovals lists an automatic send as automatic, not as a defect and not as an owner approval (R-DRAFTS-17). An automatic approval keeps empty owner words and basis automatic (SPEC-09-4). Depends on SPEC-09-4.

Last change: 2026-11-24, after the review of a17110b: the audit is the approval row; approveWithoutWords skips the shown and text checks; approvals carry an optional basis; counts read approvals; CheckApprovals reports automatic.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-5 | always | A sent message with no approval entry is a defect. The owner can check by asking the agent, "does every sent message have an approval?" Deputy shall list any sent entry that lacks one, or say there is none. An automatic approval keeps empty owner words and basis automatic; Deputy reports it as automatic, not as an owner approval. (R-DRAFTS-17) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/application/check-approvals.ts | Change | The result gains an `automatic` list of sent entries whose approval basis is automatic |
| src/drafts/domain/approval-audit.ts | Change | `ApprovalAudit` does not report an automatic approval as a defect |
| test/drafts/check-approvals-automatic.test.ts | Create | The tests below |

## Reuses
- Precedent: SPEC-04-drafts-log.md Task 4, which built `CheckApprovals` and `ApprovalAudit`.

## Tests first
- FR-DRAFTS-04-5 (7): given a sent entry whose approval has basis automatic, `CheckApprovals` lists it under `automatic` and reports no defect for it.
- FR-DRAFTS-04-5 (8): given a sent entry whose approval has basis owner_words, the result is unchanged from before (no defect, not automatic).

## Build
```ts
export function checkApprovals(...): Promise<{ defects: Defect[]; gaps: Gap[]; automatic: { entryId: number; draft: number; chat: string }[] }>;
```

## Done when
`bun test test/drafts/check-approvals-automatic.test.ts`

## Out of scope
The approval method (SPEC-09-4) and the approval repository reads (SPEC-09-5b).

## Open questions
None.

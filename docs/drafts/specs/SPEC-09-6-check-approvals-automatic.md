# SPEC-09-6: CheckApprovals reports an automatic send as automatic, and the log shows the basis

Status: Draft
Rests on: ../frd/FRD-04-drafts-log.md

## Summary

CheckApprovals lists an automatic send as automatic, not as a defect and not as an owner approval (R-DRAFTS-17). The drafts log read shows each approval's basis, so an owner_go send is verifiable (PRODUCT section 8, criterion 2). Depends on SPEC-09-4.

Last change: 2026-11-24, after the review of 7a56758: the go is one unit of work with its approval; closed window tells the owner; the always-ask list comes from Knowledge; reconcile on start; the basis is in the log read; pilotStatsTool is in the application layer.

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows
| FR-DRAFTS-04-5 | always | A sent message with no approval entry is a defect. The owner can check by asking the agent, "does every sent message have an approval?" Deputy shall list any sent entry that lacks one, or say there is none. An automatic approval keeps empty owner words and basis automatic; Deputy reports it as automatic, not as an owner approval, and the log shows each approval's basis. (R-DRAFTS-17) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/drafts/application/check-approvals.ts | Change | The result gains an `automatic` list of sent entries whose approval basis is automatic |
| src/drafts/application/read-draft-log.ts | Change | Each approval entry in the read shows its basis |
| test/drafts/check-approvals-automatic.test.ts | Create | The tests below |

## Reuses
- Precedent: SPEC-04-drafts-log.md Task 4, which built `CheckApprovals` and the log read.

## Tests first
- FR-DRAFTS-04-5 (7): given a sent entry whose approval has basis automatic, `CheckApprovals` lists it under `automatic` and reports no defect for it.
- FR-DRAFTS-04-5 (8): given a sent entry whose approval has basis owner_words, the result is unchanged from before.
- FR-DRAFTS-04-5 (9): given an owner_go send, the log read shows that approval with basis owner_go.

## Build
```ts
export function checkApprovals(...): Promise<{ defects: Defect[]; gaps: Gap[]; automatic: { entryId: number; draft: number; chat: string }[] }>;
```

## Done when
`bun test test/drafts/check-approvals-automatic.test.ts`

## Out of scope
The approval method (SPEC-09-4) and the approval reads (SPEC-09-5b).

## Open questions
None.

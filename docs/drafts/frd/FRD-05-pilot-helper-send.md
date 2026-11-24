# FRD-05: A helper sends only to the chat it was given

Status: Draft

## Summary

In the dispatcher session of the local pilot (ADR-019) a background triage helper sends an answer with `send_answer`. Deputy gives each pending chat a triage token (Intake FRD-05), and refuses a send whose token does not belong to its chat id, so a helper can send only to the chat it was given. The token does not prove that the helper's text is right (D11). See [the slice PRD](../PRD.md).

Last change: 2026-11-24, first draft. A new FRD rather than a change to the approved FRD-02, so that FRD-02 keeps its approval.

## Why

ADR-019 (the dispatcher session and its helpers) and the owner's decision of 2026-11-24 that the main session never sends. R-DRAFTS-22 lets the pilot send an answer the knowledge backs without the owner's go; this row limits which chat a helper can reach.

## Requirements covered

R-DRAFTS-22, with amendments from ADR-019 (pending owner approval): rows FR-DRAFTS-05-1 and FR-DRAFTS-05-2.

## Behavior

| ID | Pattern | Requirement |
|---|---|---|
| FR-DRAFTS-05-1 | WHEN | When `send_answer` is called, Deputy shall verify that the triage token belongs to the chat id and shall refuse a token that does not match, creating and sending nothing. (ADR-019, Proposed, lead decision.) |
| FR-DRAFTS-05-2 | WHEN | When `send_answer` is called with a token that belongs to the chat id, Deputy shall go on with the checks of FR-DRAFTS-02-13 (the always-ask list, the knowledge and the customer window) exactly as without a token. (ADR-019, Proposed, lead decision.) |

## Rules and examples

| Rule | Text | Covers |
|---|---|---|
| RULE-1 | A helper can send only to the chat whose token it holds, and never on an error of the check. | FR-DRAFTS-05-1, FR-DRAFTS-05-2 |

| Example | Rule | Kind | Given | When | Then |
|---|---|---|---|---|---|
| EX-1 | RULE-1 | positive | A helper holds the token of chat A and the knowledge backs the answer | It calls `send_answer` for chat A | The send goes on as FR-DRAFTS-02-13 says |
| EX-2 | RULE-1 | negative | A helper holds the token of chat A | It calls `send_answer` for chat B | Deputy refuses it and nothing is created or sent |
| EX-3 | RULE-1 | boundary | The token is empty, has the wrong length, or Intake's check fails with an error | `send_answer` is called | Deputy refuses it |

## Decision table
n/a: no behavior here depends on more than three conditions.

## States
n/a: the row has no states of its own; the draft states stay in FRD-01 and FRD-03.

## Invariants
INV-1: the secret behind a triage token never reaches Drafts, a result, a log or a document.

## Quality criteria
| ID | Characteristic (ISO/IEC 25010) | Criterion |
|---|---|---|
| QC-1 | Functional suitability | n/a: covered by the behavior row and examples above. |
| QC-2 | Performance efficiency | n/a: one comparison per send. |
| QC-3 | Compatibility | n/a: no new format. |
| QC-4 | Interaction capability | n/a: the owner does not see the token. |
| QC-5 | Reliability | n/a: an error of the check refuses the send, so no send goes out on a failure. |
| QC-6 | Security | A helper holding one chat's token cannot send to any other chat; checked by EX-2. |
| QC-7 | Maintainability | n/a: two small specs. |
| QC-8 | Flexibility | n/a: the token form is Intake's and can change without a change here. |
| QC-9 | Safety | n/a: the window and the knowledge checks of FR-DRAFTS-02-13 still apply to every send. |

## Cross-cutting
n/a: the project has no CROSS-CUTTING.md yet; the cross-cutting rules live in the cross-cutting TP.

## Information
- A triage token is a string Intake issues for one chat id (Intake FRD-05, FR-INTAKE-05-30). Drafts keeps no copy of it.

## Open questions
- Q-1 (Lead): Proposed, not decided: the token is tied to its chat id only and never expires, so a helper that keeps it can send to that chat later. The window check and the knowledge check still apply to every send.

## Acceptance criteria
- AC-1 (EX-1): Given a helper holds the token of chat A and the knowledge backs the answer, When it calls `send_answer` for chat A, Then the send goes on as FR-DRAFTS-02-13 says.
- AC-2 (EX-2): Given a helper holds the token of chat A, When it calls `send_answer` for chat B, Then Deputy refuses it and nothing is created or sent.
- AC-3 (EX-3): Given the token is empty, has the wrong length, or Intake's check fails with an error, When `send_answer` is called, Then Deputy refuses it.

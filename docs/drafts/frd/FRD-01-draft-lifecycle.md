# FRD-01: Draft lifecycle

Status: Draft


## Summary

The agent prepares a reply for a chat. Deputy keeps it as a draft that waits for the owner. The owner can see, edit, reject or approve it. See [the slice PRD](../PRD.md).

Last change: 2026-11-24, format 4: a Why section, rules and examples, quality criteria and the n/a references added from the existing text; rows gain "shall"; returned to Draft.

## Why

The slice PRD's requirements R-DRAFTS-1 to R-DRAFTS-5: a reply is kept as a draft that waits for the owner, the owner can see, change, reject or approve it, and no draft is ever sent by its creation.

## Requirements covered

R-DRAFTS-1, R-DRAFTS-2, R-DRAFTS-3, R-DRAFTS-4, R-DRAFTS-5.

## Behavior

| ID | Pattern | Requirement |
|---|---|---|
| FR-DRAFTS-01-1 | always | Deputy shall offer the agent a way to create a draft for a chat. The draft shall hold the chat, the proposed text, the time it was made, and the time of the latest message in that chat at that moment. Deputy shall give it an identifier the owner can refer to (a short number or name). Identifiers shall be unique and never reused, not even after a draft is closed. Reply drafts and order drafts shall share one numbering, so "go on 3" never means two things. (R-DRAFTS-1) |
| FR-DRAFTS-01-2 | always | A new draft shall never be sent. Its state shall be "waiting for the owner's go". Creating a draft shall send nothing to the provider. (R-DRAFTS-2) |
| FR-DRAFTS-01-3 | always | The owner shall be able to ask "what drafts are waiting?". The agent shall show each waiting draft with its identifier, the chat, the proposed text exactly as it would be sent, and the customer message it answers. (R-DRAFTS-3) |
| FR-DRAFTS-01-4 | always | Deputy shall offer other slices a way to ask which chats have a draft waiting. For each draft that has not been sent it shall return the chat, the time the draft was written, and its state (waiting, held, failed or unknown). It shall not return the draft text. (R-DRAFTS-3) |
| FR-DRAFTS-01-5 | always | The owner shall be able to ask the agent to change a draft's text. Deputy shall keep the new text, and the draft shall go back to "waiting for the owner's go". Any approval given for the earlier text shall be void. (R-DRAFTS-4) |
| FR-DRAFTS-01-6 | always | The owner shall be able to reject a draft. A rejected draft shall be closed and shall never be sent. (R-DRAFTS-4) |
| FR-DRAFTS-01-7 | always | A chat shall have at most one open reply draft and at most one open order draft (open means waiting, approved, or held, but not yet sent). When the agent creates a new draft for a chat that already has an open draft of the same kind, the new draft shall replace the old one, the old one shall be closed as "replaced", and any approval of the old one shall be voided. A new reply draft shall never replace an order draft, and the other way round. A draft already being sent shall not be replaced. The agent shall tell the owner that it replaced a draft. (R-DRAFTS-5) |
| FR-DRAFTS-01-8 | WHILE | Once the provider setting is not dev, Deputy shall refuse to create a draft for a chat whose only messages are dev test messages, and shall say why (FR-INTAKE-01-10). (R-DRAFTS-1) |

## Rules and examples

The rules are the behavior rows above, one rule per row. The examples are written from each rule's text and from the existing acceptance tests and edge cases of this document. Every rule has a positive example and a negative or boundary example.

| Rule | Text | Covers |
|---|---|---|
| RULE-1 | a draft holds its fields and gets an identifier that is never reused | FR-DRAFTS-01-1 |
| RULE-2 | a new draft is never sent | FR-DRAFTS-01-2 |
| RULE-3 | the owner sees each waiting draft with its text exactly as it would be sent | FR-DRAFTS-01-3 |
| RULE-4 | other slices learn which chats have a waiting draft, without the text | FR-DRAFTS-01-4 |
| RULE-5 | a changed text returns the draft to waiting and voids its approval | FR-DRAFTS-01-5 |
| RULE-6 | a rejected draft is closed and never sent | FR-DRAFTS-01-6 |
| RULE-7 | one open reply draft and one open order draft per chat; a new one replaces the old one of its kind | FR-DRAFTS-01-7 |
| RULE-8 | once the setting is not dev, dev-only chats get no draft | FR-DRAFTS-01-8 |

| ID | Rule | Kind | Given | When | Then |
|---|---|---|---|---|---|
| EX-1 | RULE-1 | positive | A reply draft and an order draft are created | the drafts are listed | they have different identifiers from one shared numbering |
| EX-2 | RULE-1 | negative | A draft was closed | a new draft is created | the new identifier differs from every earlier one |
| EX-3 | RULE-2 | positive | A chat has a customer question | the agent creates a draft | it shows as waiting, nothing is delivered to the provider, and the owner can see it with the question it answers |
| EX-4 | RULE-2 | negative | The agent calls create on a valid chat | the draft is created | nothing reaches the customer until the owner's go |
| EX-5 | RULE-3 | positive | The owner asks what drafts are waiting | the agent answers | each waiting draft shows its identifier, its chat, its proposed text exactly as it would be sent, and the customer message it answers |
| EX-6 | RULE-3 | negative | No drafts are waiting | the owner asks what drafts are waiting | the list says so plainly |
| EX-7 | RULE-4 | positive | Drafts waiting, held, failed and unknown exist | Inbox asks | each comes with its chat, the time written and its state, and no text |
| EX-8 | RULE-4 | negative | A draft was sent | Inbox asks which chats have a draft waiting | that draft is not returned |
| EX-9 | RULE-5 | positive | An approved draft that was not yet sent | the owner changes its text | the draft is waiting again and the earlier approval no longer counts |
| EX-10 | RULE-5 | negative | A draft was already sent, rejected or replaced | the owner asks to change it | Deputy says it is closed and changes nothing |
| EX-11 | RULE-6 | positive | A waiting draft | the owner rejects it | it is closed, and a later attempt to send it is refused |
| EX-12 | RULE-6 | boundary | The owner says "reject 4" and draft 4 does not exist | Deputy handles it | Deputy says so and changes nothing |
| EX-13 | RULE-7 | positive | A chat has a waiting reply draft | the agent creates another reply draft for that chat | only the new draft is waiting, the old one is closed as replaced, and the owner is told |
| EX-14 | RULE-7 | boundary | A draft is approved but not yet sent | the agent creates a new draft for that chat | the old draft is closed as replaced, its approval is void, and sending it is refused |
| EX-15 | RULE-7 | negative | A chat has an open reply draft | the agent creates an order draft for it | both stay open, and a later reply draft replaces only the reply draft |
| EX-16 | RULE-7 | boundary | The owner is looking at the older draft for a chat | the agent creates a new draft for that chat | the owner is told the older one was replaced |
| EX-17 | RULE-8 | positive | The provider setting is Kapso and the chat has only dev test messages | the agent creates a draft for it | Deputy refuses |
| EX-18 | RULE-8 | negative | The provider setting is dev | the agent creates a draft for a dev-only chat | this rule does not refuse it |
| EX-19 | RULE-4 | positive | Two chats have waiting drafts | Inbox asks which chats have a draft waiting | it gets exactly those two chats, each with the time its draft was written |
| EX-20 | RULE-6 | negative | The owner asks to reject a draft that was already sent, rejected or replaced | Deputy handles it | Deputy says it is closed and changes nothing |

## Decision table

n/a: the draft creation rules each have one condition, and the draft states are the transitions of FR-DRAFTS-01-5 to FR-DRAFTS-01-7 and FRD-02 and FRD-03, so no decision table is needed here.

## States

n/a: the draft states (waiting, approved, held, sending, sent, failed, outcome unknown, rejected, replaced) are listed in Information; their transitions are set by FR-DRAFTS-01-5 to FR-DRAFTS-01-7 and by FRD-02 and FRD-03, so no separate table is needed.

## Invariants

n/a: docs/INVARIANTS.md holds no row that names this FRD's rules yet.

## Quality criteria

| ID | Characteristic (ISO/IEC 25010) | Criterion |
|---|---|---|
| QC-1 | Functional suitability | Every FR row and every EX row of this FRD is cited by at least one test; `check.ts trace` reports no uncited id. |
| QC-2 | Performance efficiency | n/a: the existing text states no timing target for draft creation. |
| QC-3 | Compatibility | n/a: the existing text states no platform target for this FRD. |
| QC-4 | Interaction capability | n/a: the existing text states no interaction target beyond the list of FR-DRAFTS-01-3. |
| QC-5 | Reliability | A draft is never sent by its creation (FR-DRAFTS-01-2): the test creates a draft and finds no provider call. |
| QC-6 | Security | Other slices get the waiting state without the draft text (FR-DRAFTS-01-4): the test reads the answer and finds no text. |
| QC-7 | Maintainability | n/a: the existing text states no maintainability target beyond the repository rules. |
| QC-8 | Flexibility | n/a: the existing text states no change scenario for this FRD. |
| QC-9 | Safety | A rejected draft is never sent (FR-DRAFTS-01-6): the test rejects a draft and finds the later send refused. |

## Cross-cutting

n/a: docs/CROSS-CUTTING.md has no filled row for Drafts; the cross-cutting rules live in docs/tp/TP.md.

## Edge cases

- The chat does not exist or has no customer message: Deputy refuses to create the draft and says why.
- The chat's only messages are dev test messages and the provider is no longer dev: refused (FR-DRAFTS-01-8).
- Empty text: refused.
- The owner changes the text of a draft that was already approved but not yet sent: the approval is void and the draft waits again (FR-DRAFTS-01-5).
- The owner asks to change or reject a draft that was already sent, rejected or replaced: Deputy says it is closed and changes nothing.
- The owner says "reject 4" and draft 4 does not exist: Deputy says so and changes nothing.
- The agent creates a draft while the owner is looking at the older draft for that chat: the owner is told the older one was replaced, so they do not approve text that no longer exists.
- No drafts waiting: the list says so plainly.
- A draft the owner did not approve is still there in the next session. It is marked as from an earlier session, and the send path checks the chat as for any draft (decision D25).

## Information

- Draft: identifier, chat, proposed text, current text, state (waiting, approved, held, sending, sent, failed, outcome unknown, rejected, replaced), time made, time of the latest chat message when made, the customer message it answers.
- Per chat: whether a draft is waiting, and the time it was written (for Inbox and Knowledge).

## Open questions

1. Should the draft show exactly what will be sent, including line breaks and any signature line? (PRD open question 1.)
2. How is the draft identifier shown so it stays unambiguous when many drafts are waiting?

## Acceptance criteria

Generated from the examples above, one per EX row:

- AC-1: Given a reply draft and an order draft are created, When the drafts are listed, Then they have different identifiers from one shared numbering. (EX-1)
- AC-2: Given a draft was closed, When a new draft is created, Then the new identifier differs from every earlier one. (EX-2)
- AC-3: Given a chat has a customer question, When the agent creates a draft, Then it shows as waiting, nothing is delivered to the provider, and the owner can see it with the question it answers. (EX-3)
- AC-4: Given the agent calls create on a valid chat, When the draft is created, Then nothing reaches the customer until the owner's go. (EX-4)
- AC-5: Given the owner asks what drafts are waiting, When the agent answers, Then each waiting draft shows its identifier, its chat, its proposed text exactly as it would be sent, and the customer message it answers. (EX-5)
- AC-6: Given no drafts are waiting, When the owner asks what drafts are waiting, Then the list says so plainly. (EX-6)
- AC-7: Given Drafts waiting, held, failed and unknown exist, When Inbox asks, Then each comes with its chat, the time written and its state, and no text. (EX-7)
- AC-8: Given a draft was sent, When Inbox asks which chats have a draft waiting, Then that draft is not returned. (EX-8)
- AC-9: Given an approved draft that was not yet sent, When the owner changes its text, Then the draft is waiting again and the earlier approval no longer counts. (EX-9)
- AC-10: Given a draft was already sent, rejected or replaced, When the owner asks to change it, Then Deputy says it is closed and changes nothing. (EX-10)
- AC-11: Given a waiting draft, When the owner rejects it, Then it is closed, and a later attempt to send it is refused. (EX-11)
- AC-12: Given the owner says "reject 4" and draft 4 does not exist, When Deputy handles it, Then Deputy says so and changes nothing. (EX-12)
- AC-13: Given a chat has a waiting reply draft, When the agent creates another reply draft for that chat, Then only the new draft is waiting, the old one is closed as replaced, and the owner is told. (EX-13)
- AC-14: Given a draft is approved but not yet sent, When the agent creates a new draft for that chat, Then the old draft is closed as replaced, its approval is void, and sending it is refused. (EX-14)
- AC-15: Given a chat has an open reply draft, When the agent creates an order draft for it, Then both stay open, and a later reply draft replaces only the reply draft. (EX-15)
- AC-16: Given the owner is looking at the older draft for a chat, When the agent creates a new draft for that chat, Then the owner is told the older one was replaced. (EX-16)
- AC-17: Given the provider setting is Kapso and the chat has only dev test messages, When the agent creates a draft for it, Then Deputy refuses. (EX-17)
- AC-18: Given the provider setting is dev, When the agent creates a draft for a dev-only chat, Then this rule does not refuse it. (EX-18)
- AC-19: Given two chats have waiting drafts, When Inbox asks which chats have a draft waiting, Then it gets exactly those two chats, each with the time its draft was written. (EX-19)
- AC-20: Given the owner asks to reject a draft that was already sent, rejected or replaced, When Deputy handles it, Then Deputy says it is closed and changes nothing. (EX-20)
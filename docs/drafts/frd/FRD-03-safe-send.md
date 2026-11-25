# FRD-03: Safe send and outcome

Status: Draft


## Summary

Before a send, Deputy checks that the chat is up to date and that the owner has not already answered from the phone. After the send, the owner learns whether it worked. See [the slice PRD](../PRD.md).

Last change: 2026-11-24, format 4: a Why section, rules and examples, quality criteria and the n/a references added from the existing text; rows gain "shall"; returned to Draft.

## Why

The slice PRD's requirements R-DRAFTS-11 to R-DRAFTS-14 and R-DRAFTS-22: before a send Deputy checks the chat is up to date and that the owner has not already answered, and after it the owner learns whether it worked.

## Requirements covered

R-DRAFTS-11, R-DRAFTS-12, R-DRAFTS-13, R-DRAFTS-14, R-DRAFTS-22.

## Behavior

| ID | Pattern | Requirement |
|---|---|---|
| FR-DRAFTS-03-1 | WHEN | When an approved draft is about to be sent, Deputy shall first bring the chat up to date with the provider. (R-DRAFTS-11) |
| FR-DRAFTS-03-2 | IF | If the update cannot be completed, the send shall be held. Deputy shall tell the owner, for example "I could not check María's chat, so I held the send. Try again?" Nothing shall reach the customer. (R-DRAFTS-11) |
| FR-DRAFTS-03-3 | always | Deputy shall then check whether, since the draft was made, the owner answered that chat from the WhatsApp Business app, or the customer wrote again. Deputy shall use the message source that Intake recorded. It shall never decide that from message content. (R-DRAFTS-11) |
| FR-DRAFTS-03-4 | IF | If either happened, the send shall be held. Deputy shall tell the owner what happened and shall offer three choices: send as is, edit, or drop the draft. (R-DRAFTS-11) |
| FR-DRAFTS-03-5 | IF | If the owner answered from the app, the agent shall show the owner that answer. The draft shall be sent only after the owner approves again with a new go. "Send as is" shall need that new go too. (R-DRAFTS-12) |
| FR-DRAFTS-03-11 | IF | If only a customer wrote again (no owner answer from the app), the owner's "send as is" shall count as a go only if it names the draft (FRD-02). Otherwise the agent shall ask for a new go. Deputy shall offer all three choices in this case. (R-DRAFTS-11) |
| FR-DRAFTS-03-12 | WHEN | Each held send, the owner's choice (send as is, edit, drop), and a voided approval shall be logged. (R-DRAFTS-11) |
| FR-DRAFTS-03-6 | WHEN | After a send, the owner shall be told that the provider accepted it, or that it failed and why, in plain words. (R-DRAFTS-13) |
| FR-DRAFTS-03-7 | always | A failed send shall stay visible with its reason. It shall be retried only after a new approval. No retry shall happen by itself, with one exception (decision D29): when the provider answers "too many requests" (429), nothing was delivered, and the approved send shall wait in a queue for that chat and be retried at the time the provider gives. Other chats shall not be delayed. Before the retry, every check of FR-DRAFTS-03-3 shall run again, and Deputy shall also check that the draft did not change. If anything changed, Deputy shall hold the send and ask the owner again. If the retry time falls outside WhatsApp's 24-hour window for that customer, the send shall fail at once and the owner shall be told. (R-DRAFTS-13) |
| FR-DRAFTS-03-8 | IF | If it is not known whether the first attempt reached the customer (for example, the connection dropped after the request), the owner shall be told this. Deputy shall not retry. The owner decides, after checking the chat. (R-DRAFTS-13) |
| FR-DRAFTS-03-9 | WHEN | When the provider accepts a message, Deputy shall write the "sent" event in the log and give Intake the send identifier. Intake shall record the message in the chat once, as sent by Deputy. (R-DRAFTS-14) |
| FR-DRAFTS-03-13 | WHEN | When a send ends as "outcome unknown", Deputy shall resolve it against Intake by matching the chat, a time window around the send, and the text. When it finds exactly one match, it shall link that message to the send and record the send as sent. If it finds none, the state shall stay "outcome unknown" (a provider can lag, so "not found" does not mean "not delivered"), and the owner decides after checking the chat (FR-DRAFTS-03-8). If several messages in the window match by text (for example the owner wrote the same text from the app), the match is ambiguous: nothing shall be linked and the state shall stay "outcome unknown". Only a failure reported by the provider shall be recorded as "failed". A linked message shall never be treated as an owner answer from the app. (R-DRAFTS-13, R-DRAFTS-14) |
| FR-DRAFTS-03-14 | WHEN | When an automatic answer is ready and the customer's 24 hour window is closed, Deputy shall not send and shall tell the owner, as ADR-012 does for a retry. (R-DRAFTS-22) |
| FR-DRAFTS-03-10 | WHEN | When the provider later reports the same message back, it shall not be recorded a second time. (R-DRAFTS-14) |

## Rules and examples

The rules are the behavior rows above, one rule per row. The examples are written from each rule's text and from the existing acceptance tests and edge cases of this document. Every rule has a positive example and a negative or boundary example.

| Rule | Text | Covers |
|---|---|---|
| RULE-1 | the chat is brought up to date before an approved draft is sent | FR-DRAFTS-03-1 |
| RULE-2 | a failed update holds the send and the owner is told | FR-DRAFTS-03-2 |
| RULE-3 | app replies and new customer messages are checked with the sources Intake recorded | FR-DRAFTS-03-3 |
| RULE-4 | an app reply or a new customer message holds the send and offers three choices | FR-DRAFTS-03-4 |
| RULE-5 | an owner answer from the app is shown, and the send needs a new go | FR-DRAFTS-03-5 |
| RULE-6 | when only a customer wrote again, "send as is" counts only if it names the draft | FR-DRAFTS-03-11 |
| RULE-7 | each held send, choice and voided approval is logged | FR-DRAFTS-03-12 |
| RULE-8 | after a send the owner is told the result in plain words | FR-DRAFTS-03-6 |
| RULE-9 | a failed send is visible and retried only after a new approval; a 429 waits in the chat's queue | FR-DRAFTS-03-7 |
| RULE-10 | an unknown first attempt is reported and never retried by Deputy | FR-DRAFTS-03-8 |
| RULE-11 | an accepted send is logged and recorded in the chat once | FR-DRAFTS-03-9, FR-DRAFTS-03-10 |
| RULE-12 | an outcome unknown is resolved by one matching message in the window, or stays unknown | FR-DRAFTS-03-13 |
| RULE-13 | an automatic answer is not sent when the customer's 24 hour window is closed | FR-DRAFTS-03-14 |

| ID | Rule | Kind | Given | When | Then |
|---|---|---|---|---|---|
| EX-1 | RULE-1 | positive | An approved draft is about to be sent | the agent sends it | Deputy has first brought the chat up to date |
| EX-2 | RULE-1 | boundary | The chat is already up to date | the send is checked | the check passes without waiting for the update |
| EX-3 | RULE-2 | positive | An approved draft and a provider that cannot be reached for the update | the agent sends | the send is held and the owner is told |
| EX-4 | RULE-2 | negative | The chat update completes | the agent sends | the send is not held for a failed update |
| EX-5 | RULE-3 | positive | The owner answered the chat from the app after the draft, and the agent sends | Deputy checks | it uses the source Intake recorded |
| EX-6 | RULE-3 | negative | A message's text says the owner answered | Deputy checks | it does not decide the answer from the content |
| EX-7 | RULE-4 | positive | The owner answered the chat from the app and then the agent sends | Deputy checks | the send is held, the owner sees the answer, and nothing goes out until the owner approves again |
| EX-8 | RULE-4 | boundary | The owner's answer from the app says the same thing as the draft | Deputy holds the send | the owner can drop the draft |
| EX-9 | RULE-5 | positive | An approved send held by an owner answer from the app | the owner approves again with a new go | the send goes ahead |
| EX-10 | RULE-5 | negative | "Send as is" is said without a new go | the agent acts | nothing is sent |
| EX-11 | RULE-6 | positive | A customer wrote again after the draft, and the owner says "send as is" without naming the draft | the agent handles it | nothing is sent and the agent asks for a go that names it |
| EX-12 | RULE-6 | boundary | A customer wrote again and the owner's "send as is" names the draft | the agent handles it | it counts as a go |
| EX-13 | RULE-7 | positive | A held send and the owner picks edit | the choice is logged | the choice and the held reason are in the log |
| EX-14 | RULE-7 | negative | A voided approval exists | the log is read | the void is in the log |
| EX-15 | RULE-8 | positive | A send was accepted by the provider | the owner is told | the owner is told in plain words that the provider accepted it |
| EX-16 | RULE-8 | negative | A send failed | the owner is told | the owner is told it failed and why |
| EX-17 | RULE-9 | positive | A provider answers 429 with a retry time 40 seconds ahead, and nothing changed in the chat | the time comes | the message is sent once |
| EX-18 | RULE-9 | boundary | The customer wrote in between the 429 and the retry | the retry time comes | the send is held and the owner is asked again |
| EX-19 | RULE-9 | negative | The retry time falls after the 24-hour window closes | the retry is due | the send fails at once and the owner is told |
| EX-20 | RULE-9 | negative | A provider fails a send | the owner is told | the log shows failed, no duplicate arrives later, and a retry is refused until a new approval |
| EX-21 | RULE-10 | positive | A send whose outcome is unknown | the owner is told | Deputy does not retry by itself |
| EX-22 | RULE-10 | negative | A send whose outcome is unknown | the owner decides | the owner decides after checking the chat |
| EX-23 | RULE-11 | positive | An accepted send, and the provider reports the message back later | the chat is read | the chat holds the message once, as sent by Deputy |
| EX-24 | RULE-11 | boundary | The provider reports Deputy's message before Intake has the send identifier | both have arrived | the chat holds one message, as sent through Deputy, and the next draft is not held for it |
| EX-25 | RULE-12 | positive | A send with outcome unknown and one chat message with the same text inside the window | Deputy resolves it | the message is linked, and the draft shows as sent |
| EX-26 | RULE-12 | negative | A send with outcome unknown and no matching message after catch-up | Deputy resolves it | the state stays outcome unknown and nothing is sent again without a new go |
| EX-27 | RULE-12 | boundary | A send with outcome unknown and two messages in the window with the same text | Deputy resolves it | nothing is linked and the state stays outcome unknown |
| EX-28 | RULE-13 | positive | An automatic answer is ready and the customer's 24 hour window is closed | Deputy handles it | it does not send and tells the owner |
| EX-29 | RULE-13 | negative | An automatic answer is ready and the customer's window is open | Deputy handles it | this rule does not hold it |

## Decision table

The check before a send decides whether it goes or is held (FR-DRAFTS-03-1 to FR-DRAFTS-03-4 and FR-DRAFTS-03-11):

| ID | Chat update | Owner answered from the app since the draft | Customer wrote again since the draft | Result |
|---|---|---|---|---|
| DT-1 | cannot be completed | any | any | held, owner told; nothing reaches the customer (FR-DRAFTS-03-2) |
| DT-2 | completed | yes | any | held; owner sees the answer and approves again with a new go (FR-DRAFTS-03-4, FR-DRAFTS-03-5) |
| DT-3 | completed | no | yes | held; "send as is" counts as a go only if it names the draft (FR-DRAFTS-03-11) |
| DT-4 | completed | no | no | sent under the approval (FR-DRAFTS-03-1, FR-DRAFTS-03-3) |

## States

n/a: the send outcomes (accepted, failed, outcome unknown) and the held state are set by FR-DRAFTS-03-6 to FR-DRAFTS-03-13 and are listed in Information; no separate transition table is needed.

## Invariants

n/a: docs/INVARIANTS.md holds no row that names this FRD's rules yet.

## Quality criteria

| ID | Characteristic (ISO/IEC 25010) | Criterion |
|---|---|---|
| QC-1 | Functional suitability | Every FR row and every EX row of this FRD is cited by at least one test; `check.ts trace` reports no uncited id. |
| QC-2 | Performance efficiency | n/a: the existing text states no timing target beyond the 429 retry time the provider gives. |
| QC-3 | Compatibility | n/a: the existing text states no platform target for this FRD. |
| QC-4 | Interaction capability | n/a: the existing text states no interaction target beyond the three choices of FR-DRAFTS-03-4. |
| QC-5 | Reliability | A send whose outcome is unknown is not retried by Deputy (FR-DRAFTS-03-8): the test drops the connection after the request and finds one attempt only. |
| QC-6 | Security | A linked message is never treated as an owner answer from the app (FR-DRAFTS-03-13): the test links a send and finds no owner answer recorded. |
| QC-7 | Maintainability | n/a: the existing text states no maintainability target beyond the repository rules. |
| QC-8 | Flexibility | n/a: the existing text states no change scenario for this FRD. |
| QC-9 | Safety | A held send never reaches the customer (FR-DRAFTS-03-2): the test holds a send and finds no provider call. |

## Cross-cutting

n/a: docs/CROSS-CUTTING.md has no filled row for Drafts; the cross-cutting rules live in docs/tp/TP.md.

## Edge cases

- Catch-up cannot complete (provider down, credentials rejected): held, owner told, nothing sent.
- The customer wrote again and the draft no longer answers the question: the owner chooses edit or drop.
- The owner answered from the app and the answer says the same thing: the owner can drop the draft.
- The provider reply is slow: Deputy waits, and if the outcome is unknown it follows FR-DRAFTS-03-8.
- Session closed during the send: on the next start, the log shows the draft as "sent", "failed" or "outcome unknown", never as waiting for a repeat send (FR-DRAFTS-02-12).
- The provider's report of Deputy's own message arrives before Deputy gives Intake the send identifier: Intake still ends with one message, with source "sent through Deputy", and the report is never treated as an owner reply from the app, so no later draft is held for that false reason.
- The owner approved and then the chat changed: the old approval does not cover the held send; FR-DRAFTS-03-5 requires a new go.

## Information

- Per draft at send time: catch-up result, whether an owner reply from the app or a new customer message came after the draft, the owner's choice.
- Per send: provider result (accepted, failed, unknown), reason in plain words, send identifier.

## Open questions

1. How long may the update of the chat take before Deputy gives up and holds the send?
2. How does Intake mark a send whose outcome is unknown?

## Acceptance criteria

Generated from the examples above, one per EX row:

- AC-1: Given an approved draft is about to be sent, When the agent sends it, Then Deputy has first brought the chat up to date. (EX-1)
- AC-2: Given the chat is already up to date, When the send is checked, Then the check passes without waiting for the update. (EX-2)
- AC-3: Given an approved draft and a provider that cannot be reached for the update, When the agent sends, Then the send is held and the owner is told. (EX-3)
- AC-4: Given the chat update completes, When the agent sends, Then the send is not held for a failed update. (EX-4)
- AC-5: Given the owner answered the chat from the app after the draft, and the agent sends, When Deputy checks, Then it uses the source Intake recorded. (EX-5)
- AC-6: Given a message's text says the owner answered, When Deputy checks, Then it does not decide the answer from the content. (EX-6)
- AC-7: Given the owner answered the chat from the app and then the agent sends, When Deputy checks, Then the send is held, the owner sees the answer, and nothing goes out until the owner approves again. (EX-7)
- AC-8: Given the owner's answer from the app says the same thing as the draft, When Deputy holds the send, Then the owner can drop the draft. (EX-8)
- AC-9: Given an approved send held by an owner answer from the app, When the owner approves again with a new go, Then the send goes ahead. (EX-9)
- AC-10: Given "Send as is" is said without a new go, When the agent acts, Then nothing is sent. (EX-10)
- AC-11: Given a customer wrote again after the draft, and the owner says "send as is" without naming the draft, When the agent handles it, Then nothing is sent and the agent asks for a go that names it. (EX-11)
- AC-12: Given a customer wrote again and the owner's "send as is" names the draft, When the agent handles it, Then it counts as a go. (EX-12)
- AC-13: Given a held send and the owner picks edit, When the choice is logged, Then the choice and the held reason are in the log. (EX-13)
- AC-14: Given a voided approval exists, When the log is read, Then the void is in the log. (EX-14)
- AC-15: Given a send was accepted by the provider, When the owner is told, Then the owner is told in plain words that the provider accepted it. (EX-15)
- AC-16: Given a send failed, When the owner is told, Then the owner is told it failed and why. (EX-16)
- AC-17: Given a provider answers 429 with a retry time 40 seconds ahead, and nothing changed in the chat, When the time comes, Then the message is sent once. (EX-17)
- AC-18: Given the customer wrote in between the 429 and the retry, When the retry time comes, Then the send is held and the owner is asked again. (EX-18)
- AC-19: Given the retry time falls after the 24-hour window closes, When the retry is due, Then the send fails at once and the owner is told. (EX-19)
- AC-20: Given a provider fails a send, When the owner is told, Then the log shows failed, no duplicate arrives later, and a retry is refused until a new approval. (EX-20)
- AC-21: Given a send whose outcome is unknown, When the owner is told, Then Deputy does not retry by itself. (EX-21)
- AC-22: Given a send whose outcome is unknown, When the owner decides, Then the owner decides after checking the chat. (EX-22)
- AC-23: Given an accepted send, and the provider reports the message back later, When the chat is read, Then the chat holds the message once, as sent by Deputy. (EX-23)
- AC-24: Given the provider reports Deputy's message before Intake has the send identifier, When both have arrived, Then the chat holds one message, as sent through Deputy, and the next draft is not held for it. (EX-24)
- AC-25: Given a send with outcome unknown and one chat message with the same text inside the window, When Deputy resolves it, Then the message is linked, and the draft shows as sent. (EX-25)
- AC-26: Given a send with outcome unknown and no matching message after catch-up, When Deputy resolves it, Then the state stays outcome unknown and nothing is sent again without a new go. (EX-26)
- AC-27: Given a send with outcome unknown and two messages in the window with the same text, When Deputy resolves it, Then nothing is linked and the state stays outcome unknown. (EX-27)
- AC-28: Given an automatic answer is ready and the customer's 24 hour window is closed, When Deputy handles it, Then it does not send and tells the owner. (EX-28)
- AC-29: Given an automatic answer is ready and the customer's window is open, When Deputy handles it, Then this rule does not hold it. (EX-29)

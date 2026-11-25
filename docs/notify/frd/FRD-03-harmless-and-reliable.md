# FRD-03: Harmless and reliable

Status: Draft

## Summary

A notice never sends, approves or loses anything. Without push, or when a notice fails, the inbox still shows every message. See [the slice PRD](../PRD.md).

Last change: 2026-11-24, format 4: a Why section, rules and examples, quality criteria and the n/a references added from the existing text; rows gain "shall"; returned to Draft.

## Why

The slice PRD's requirements R-NOTIFY-8 to R-NOTIFY-11: a notice never sends, approves or loses anything, and without push or when a notice fails, the inbox still shows every message (see the [slice PRD](../PRD.md)).

## Requirements covered

R-NOTIFY-8, R-NOTIFY-9, R-NOTIFY-10, R-NOTIFY-11.

## Behavior

| ID | Pattern | Requirement |
|---|---|---|
| FR-NOTIFY-03-1 | always | A message the owner sends from the WhatsApp Business app shall not raise a notice by itself. Deputy shall use the message source that Intake recorded, never the message content. (R-NOTIFY-8) |
| FR-NOTIFY-03-2 | always | A chat the owner has already answered shall be neither counted as new nor as waiting. (R-NOTIFY-8) |
| FR-NOTIFY-03-3 | always | Notify shall send nothing to a customer and shall approve nothing. Receiving a notice shall not cause a send or an approval. (R-NOTIFY-9) |
| FR-NOTIFY-03-4 | IF | With an agent that does not support push, or with no session open, no notice shall be sent. The rule is stated in [R-NOTIFY-10](../PRD.md). (R-NOTIFY-10) |
| FR-NOTIFY-03-5 | always | Messages that arrived while no session was open shall be found by catch-up at the next start and shall be covered by one notice (see FRD-01). (R-NOTIFY-10) |
| FR-NOTIFY-03-6 | always | A notice shall count as failed when there is no open session at the moment of sending, or when writing it to the session returns an error. A push has no acknowledgement, so a notice that was written without error counts as delivered. If a notice cannot be delivered, Deputy shall keep storing messages and the inbox shall keep listing them. The failure is not shown to the customer. The failure is recorded where the owner can see it, for example in the status. (R-NOTIFY-11) |
| FR-NOTIFY-03-8 | WHEN | When Intake's status shows the provider unreachable for longer than one catch-up period, Deputy shall send one notice with fixed wording: "Cannot reach the provider since <time>." It shall carry no customer data. It shall be sent once per outage. When the provider is reachable again, one notice shall say so. These notices shall follow the owner's quiet periods and the notices-off setting. (R-NOTIFY-11) |
| FR-NOTIFY-03-7 | WHEN | After a failed notice, the next notice shall count the messages that failed to notify as new, so no count is lost. (R-NOTIFY-11) |
| FR-NOTIFY-03-9 | WHEN | When a queued send is held or fails (decision D29), or an owner reply cannot be tied to a chat (decision D30), Deputy shall raise one notice for each event. The notice shall name one of four reasons (`held_after_retry`, `window_closed`, `retry_failed`, `owner_reply_unlinked`), says why and what the owner must do, and holds no chat, name, number or customer text. It follows the same gates as every notice. (R-NOTIFY-8) |

## Rules and examples

The rules are the behavior rows above, one rule per row. The examples are written from each rule's text and from the existing acceptance tests and edge cases of this document. Every rule has a positive example and a negative or boundary example.

| Rule | Text | Covers |
|---|---|---|
| RULE-1 | an owner message from the app does not raise a notice, judged by source | FR-NOTIFY-03-1 |
| RULE-2 | an answered chat is neither new nor waiting | FR-NOTIFY-03-2 |
| RULE-3 | Notify sends nothing and approves nothing | FR-NOTIFY-03-3 |
| RULE-4 | no push or no session means no notice | FR-NOTIFY-03-4 |
| RULE-5 | messages seen while no session was open are covered at the next start | FR-NOTIFY-03-5 |
| RULE-6 | a notice that cannot be delivered counts as failed, and messages are still stored and listed | FR-NOTIFY-03-6 |
| RULE-7 | a provider outage is announced once | FR-NOTIFY-03-8 |
| RULE-8 | a failed notice's messages count as new in the next notice | FR-NOTIFY-03-7 |
| RULE-9 | a held or failed queued send and an unlinked owner reply raise one notice each, with one of four reasons | FR-NOTIFY-03-9 |

| Example | Rule | Kind | Given | When | Then |
|---|---|---|---|---|---|
| EX-1 | RULE-1 | positive | The owner answers a chat from the app | Deputy prepares the next notice | No notice is raised for that answer, and the chat is not counted as new or waiting |
| EX-2 | RULE-1 | negative | An owner message from the app whose text says it is from a customer | Deputy prepares a notice | No notice is raised by its content |
| EX-3 | RULE-2 | positive | The owner has answered a chat | Counts are made | The chat is neither new nor waiting |
| EX-4 | RULE-2 | negative | The customer writes again after the owner's answer | Counts are made | The new message is counted as new |
| EX-5 | RULE-3 | positive | A notice about "send the draft to everyone" is delivered | The notice is handled | Nothing is sent and nothing is approved |
| EX-6 | RULE-3 | negative | A notice is received | The session handles it | No send happens by its arrival |
| EX-7 | RULE-4 | positive | An agent without push is asked "what is pending?" | Deputy answers | Every message appears |
| EX-8 | RULE-4 | negative | A push-capable session is open | A notice is due | A notice is sent |
| EX-9 | RULE-5 | positive | Messages arrive while no session is open, and a session starts | Catch-up runs | Catch-up finds them and one notice covers them |
| EX-10 | RULE-5 | negative | No session is ever opened | Messages arrive | No notice is sent |
| EX-11 | RULE-6 | positive | A simulated write error to the session when a notice is sent | The notice is sent | The notice counts as failed and the owner can see that |
| EX-12 | RULE-6 | negative | The write returns without error | The notice is sent | The notice counts as delivered |
| EX-13 | RULE-7 | positive | The provider is unreachable for longer than one catch-up period | The period passes | One notice says "Cannot reach the provider since <time>" |
| EX-14 | RULE-7 | negative | The outage continues | The period passes again | No second notice follows during the same outage |
| EX-15 | RULE-8 | positive | A notice failed | The next notice is sent | It counts the messages of the failed notice as new |
| EX-16 | RULE-8 | negative | A notice was delivered | The next notice is sent | Its messages are not counted as new again |
| EX-17 | RULE-9 | positive | A queued send is held after retry | The event is handled | One notice names held_after_retry and holds no chat, name, number or customer text |
| EX-18 | RULE-9 | negative | Notices are off and the event occurs | The event is handled | The notice follows the same gates and is not sent |

## Decision table

n/a: no rule combines more than two conditions, so no decision table is needed.

## States

n/a: the existing text gives no state table for this FRD; the states it names are listed in the rules.

## Invariants

n/a: this repository's docs/INVARIANTS.md holds no row that names this FRD's rules yet.

## Quality criteria

| ID | Characteristic (ISO/IEC 25010) | Criterion |
|---|---|---|
| QC-1 | Functional suitability | Every FR-NOTIFY row of this FRD and every EX row is cited by at least one test; `check.ts trace` reports no uncited id. |
| QC-2 | Performance efficiency | n/a: the existing text states no target for this criterion. |
| QC-3 | Compatibility | n/a: the existing text states no target for this criterion. |
| QC-4 | Interaction capability | n/a: the existing text states no target for this criterion. |
| QC-5 | Reliability | A notice that cannot be delivered does not stop messages being stored (FR-NOTIFY-03-6): the test makes the write fail and finds the messages stored and listed. |
| QC-6 | Security | Notify sends nothing and approves nothing (FR-NOTIFY-03-3): the test counts sends and approvals while notices are delivered and finds 0. |
| QC-7 | Maintainability | n/a: the existing text states no target for this criterion. |
| QC-8 | Flexibility | n/a: the existing text states no target for this criterion. |
| QC-9 | Safety | No notice is sent without an open session (FR-NOTIFY-03-4): the test runs with no session and counts the notices sent as 0. |

## Cross-cutting

n/a: docs/CROSS-CUTTING.md has no filled row; the cross-cutting rules live in docs/tp/TP.md, and no CC-n row applies to Notify in it yet.

## Edge cases

- The owner answers a chat from the app, and the customer then writes again: the new message is counted as new.
- The owner answers from the app while a notice is waiting for the period to end: the chat is left out of the waiting count when the notice is sent.
- The agent supports push but the start-up option was not set: same as no push, FR-NOTIFY-03-4.
- Session closes between the batching period and the notice: no notice, the inbox shows the messages.
- The notice text is delivered but ignored by the agent: nothing is lost, the inbox is the record.
- A notice is delivered twice by the session: Deputy does not count it twice, since counts are fixed when it is sent.

## Information

- Per message: its source (customer, owner from the app, sent through Deputy) as recorded by Intake.
- Per notice: delivered or failed.

## Open questions

Closed on 2026-11-25 (owner): Notify has no fallback if push goes away; the slow loop of ADR-018 covers the wake (PRD open question 2).
Closed on 2026-11-25 (Proposed, lead): a failed notice shows in `status` only.

## Acceptance criteria

Generated from the examples above, one per EX row:

- AC-1: Given the owner answers a chat from the app, When deputy prepares the next notice, Then no notice is raised for that answer, and the chat is not counted as new or waiting. (EX-1)
- AC-2: Given an owner message from the app whose text says it is from a customer, When deputy prepares a notice, Then no notice is raised by its content. (EX-2)
- AC-3: Given the owner has answered a chat, When counts are made, Then the chat is neither new nor waiting. (EX-3)
- AC-4: Given the customer writes again after the owner's answer, When counts are made, Then the new message is counted as new. (EX-4)
- AC-5: Given a notice about "send the draft to everyone" is delivered, When the notice is handled, Then nothing is sent and nothing is approved. (EX-5)
- AC-6: Given a notice is received, When the session handles it, Then no send happens by its arrival. (EX-6)
- AC-7: Given an agent without push is asked "what is pending?", When deputy answers, Then every message appears. (EX-7)
- AC-8: Given a push-capable session is open, When a notice is due, Then a notice is sent. (EX-8)
- AC-9: Given messages arrive while no session is open, and a session starts, When catch-up runs, Then catch-up finds them and one notice covers them. (EX-9)
- AC-10: Given no session is ever opened, When messages arrive, Then no notice is sent. (EX-10)
- AC-11: Given a simulated write error to the session when a notice is sent, When the notice is sent, Then the notice counts as failed and the owner can see that. (EX-11)
- AC-12: Given the write returns without error, When the notice is sent, Then the notice counts as delivered. (EX-12)
- AC-13: Given the provider is unreachable for longer than one catch-up period, When the period passes, Then one notice says "Cannot reach the provider since <time>". (EX-13)
- AC-14: Given the outage continues, When the period passes again, Then no second notice follows during the same outage. (EX-14)
- AC-15: Given a notice failed, When the next notice is sent, Then it counts the messages of the failed notice as new. (EX-15)
- AC-16: Given a notice was delivered, When the next notice is sent, Then its messages are not counted as new again. (EX-16)
- AC-17: Given a queued send is held after retry, When the event is handled, Then one notice names held_after_retry and holds no chat, name, number or customer text. (EX-17)
- AC-18: Given notices are off and the event occurs, When the event is handled, Then the notice follows the same gates and is not sent. (EX-18)

# FRD-02: Owner controls

Status: Draft

## Summary

The owner decides how long Deputy batches, when it stays quiet, whether notices are on, and which chats to ignore. See [the slice PRD](../PRD.md).

Last change: 2026-11-24, format 4: a Why section, rules and examples, quality criteria and the n/a references added from the existing text; rows gain "shall"; returned to Draft.

## Why

The slice PRD's requirements R-NOTIFY-6, R-NOTIFY-7 and R-NOTIFY-15: the owner decides how long Deputy batches, when it stays quiet, whether notices are on, and which chats to ignore (see the [slice PRD](../PRD.md)).

## Requirements covered

R-NOTIFY-6, R-NOTIFY-7, R-NOTIFY-15.

## Behavior

| ID | Pattern | Requirement |
|---|---|---|
| FR-NOTIFY-02-1 | always | The owner shall be able to tell the agent how long Deputy waits to batch messages. Deputy keeps the choice and uses it from the next period. Without a choice, the default shall be 10 minutes. (R-NOTIFY-6) |
| FR-NOTIFY-02-9 | always | The owner shall be able to set the reminder period (default 30 minutes), and shall be able to pause reminders and resume them. While reminders are paused, notices for new messages shall still go out. Quiet periods and the notices-off setting stop reminders too. (R-NOTIFY-6, R-NOTIFY-7) |
| FR-NOTIFY-02-2 | always | The owner shall be able to set quiet periods, for example "no notices from 22:00 to 07:00". Quiet periods use the owner's local time zone and clock time, so a change of the clock (daylight saving, travel) moves them with the clock. During a quiet period no notice shall be sent. (R-NOTIFY-6) |
| FR-NOTIFY-02-3 | always | Messages that arrive in a quiet period shall be summarized in the first notice after it ends, with one count for all of them. (R-NOTIFY-6) |
| FR-NOTIFY-02-4 | always | The batching period shall accept 1 minute to 24 hours. The reminder period shall accept 5 minutes to 24 hours. Units are minutes. If the value the owner asks for is outside the range, Deputy shall say the range and shall keep the old value. (R-NOTIFY-6) |
| FR-NOTIFY-02-5 | always | The owner shall be able to turn notices off, and on again. With notices off, nothing else shall change: messages are stored and the inbox lists them. (R-NOTIFY-7) |
| FR-NOTIFY-02-6 | always | The ignore list shall belong to the Inbox slice (FR-INBOX-03-10). The owner ignores and un-ignores chats there, by explicit command only, and Inbox logs each change with the owner's words. Notify shall only read the list and shall keep no copy and no log of its own. Deputy shall never ignore a chat on its own judgment. (R-NOTIFY-15) |
| FR-NOTIFY-02-7 | always | An ignored chat shall be left out of notices, both new and waiting counts. The messages shall still be stored and the inbox shall still list them. (R-NOTIFY-15) |
| FR-NOTIFY-02-10 | WHEN | Each time Deputy prepares a notice, it shall read the current ignore list from Inbox, so a change shall take effect in the next notice and shall survive a restart. Inbox shall show the list and how many ignored chats have unanswered messages, so an ignore shall not hide a chat silently. (R-NOTIFY-15) |
| FR-NOTIFY-02-8 | WHEN | When the owner stops ignoring a chat in Inbox, the chat shall count again in the next notice. (R-NOTIFY-15) |

Example:

> Owner: ignore María's chat, it is my sister.
> Agent: Done. María's chat will not appear in notices. Say "stop ignoring María" to undo.

## Rules and examples

The rules are the behavior rows above, one rule per row. The examples are written from each rule's text and from the existing acceptance tests and edge cases of this document. Every rule has a positive example and a negative or boundary example.

| Rule | Text | Covers |
|---|---|---|
| RULE-1 | the batching period is the owner's choice, default 10 minutes | FR-NOTIFY-02-1 |
| RULE-2 | the reminder period and its pause | FR-NOTIFY-02-9 |
| RULE-3 | quiet periods in local clock time | FR-NOTIFY-02-2 |
| RULE-4 | messages in a quiet period are summarized after it ends | FR-NOTIFY-02-3 |
| RULE-5 | the period ranges and refusal outside them | FR-NOTIFY-02-4 |
| RULE-6 | notices can be turned off and on | FR-NOTIFY-02-5 |
| RULE-7 | the ignore list belongs to Inbox and only the owner changes it | FR-NOTIFY-02-6 |
| RULE-8 | an ignored chat is left out of both counts, its messages still stored | FR-NOTIFY-02-7 |
| RULE-9 | the current ignore list is read at each notice and survives a restart | FR-NOTIFY-02-10 |
| RULE-10 | stopping an ignore counts the chat again | FR-NOTIFY-02-8 |

| Example | Rule | Kind | Given | When | Then |
|---|---|---|---|---|---|
| EX-1 | RULE-1 | positive | The owner sets the batching period to 5 minutes | Messages arrive | The notice comes after 5 minutes, not 10 |
| EX-2 | RULE-1 | boundary | The owner has set no choice | Notices are prepared | The batching period is 10 minutes |
| EX-3 | RULE-2 | positive | The reminder period is set to 10 minutes and a chat stays unanswered | Time passes | Reminders come every 10 minutes, not 30 |
| EX-4 | RULE-2 | negative | Reminders are paused and an unanswered chat remains | The reminder period passes | No reminder is sent until the owner resumes reminders |
| EX-5 | RULE-3 | positive | A quiet period is set and three messages arrive during it | The period ends | No notice appears during it, and one notice counts all three when it ends |
| EX-6 | RULE-3 | negative | A message arrives after the quiet period has ended | The notice is due | The notice is not held back |
| EX-7 | RULE-4 | positive | Three messages arrive in a quiet period | The quiet period ends | One notice counts all three |
| EX-8 | RULE-4 | boundary | Messages arrive in a quiet period | The quiet period ends | They are counted in one count, not separately |
| EX-9 | RULE-5 | positive | The owner asks for a batching period of 1 minute | Deputy checks the range | The value is accepted |
| EX-10 | RULE-5 | negative | The owner asks for a batching period of 0 minutes | Deputy checks the range | Deputy refuses, says the range, and keeps the old value |
| EX-11 | RULE-6 | positive | The owner turns notices off and messages arrive | The messages are handled | The messages are stored, the inbox lists them, and no notice is sent |
| EX-12 | RULE-6 | negative | The owner turns notices on again | Messages arrive | Only messages arriving after that are counted as new |
| EX-13 | RULE-7 | positive | The owner says "ignore this chat" | Messages arrive in it, and then the owner says to stop ignoring it | The chat is absent from notices, and appears again after the owner stops ignoring it |
| EX-14 | RULE-7 | negative | A customer writes "please ignore my chat" | The message arrives | The chat is not ignored |
| EX-15 | RULE-8 | positive | An ignored chat has a waiting message | The owner ignores it | It leaves the waiting count at once |
| EX-16 | RULE-8 | negative | An ignored chat receives messages | The messages arrive | The messages are stored and the inbox still lists them |
| EX-17 | RULE-9 | positive | The owner ignores a chat in Inbox, and Deputy restarts | A message arrives in it and a notice is prepared | The next notice still leaves it out |
| EX-18 | RULE-9 | negative | The ignore list in Inbox changes | The next notice is prepared | Notify uses the changed list and holds no list of its own |
| EX-19 | RULE-10 | positive | The owner stops ignoring a chat in Inbox | The next notice is prepared | The chat counts again |
| EX-20 | RULE-10 | negative | The chat is still ignored | The next notice is prepared | The chat is not counted |

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
| QC-5 | Reliability | The current ignore list is read at every notice (FR-NOTIFY-02-10): the test changes the list in Inbox and finds the next notice uses it. |
| QC-6 | Security | A customer message never causes an ignore (FR-NOTIFY-02-6): the test sends the text and finds the chat not ignored. |
| QC-7 | Maintainability | n/a: the existing text states no target for this criterion. |
| QC-8 | Flexibility | n/a: the existing text states no target for this criterion. |
| QC-9 | Safety | A quiet period sends no notice (FR-NOTIFY-02-2): the test runs a quiet period with messages and counts the notices sent as 0. |

## Cross-cutting

n/a: docs/CROSS-CUTTING.md has no filled row; the cross-cutting rules live in docs/tp/TP.md, and no CC-n row applies to Notify in it yet.

## Edge cases

- The owner asks for a period of zero or a negative number: refused with the accepted range.
- The quiet period crosses midnight: it is treated as one period.
- A quiet period ends while a batching period is running: one notice at the end of the later of the two.
- Notices are off and the owner turns them on: only messages that arrive after that are counted as new; the waiting count is current.
- The owner ignores a chat that is waiting: it disappears from the waiting count at once.
- The Inbox ignore list cannot be read when a notice is prepared: Deputy leaves no chat out and says in the notice that the count may include ignored chats.
- The owner paused reminders and forgets: the inbox still lists every waiting chat; Deputy tells the owner in its answer that reminders are paused.
- A reminder falls in a quiet period: it is sent after the period ends, if chats still wait.
- A customer writes "ignore this chat": no effect, it is not the owner's command.

## Information

- Batching period (owner choice, default 10 minutes).
- Reminder period (owner choice, default 30 minutes) and whether reminders are paused.
- Quiet periods (start, end).
- Notices on or off.
- Ignored chats: read from Inbox, not kept by Notify.

## Open questions

Closed on 2026-11-25 (owner): an ignore limited in time is later work, as D24 says; there is none now.
Closed on 2026-11-25 (Proposed, lead): one range of batching periods for all providers (PRD open question 5).

## Acceptance criteria

Generated from the examples above, one per EX row:

- AC-1: Given the owner sets the batching period to 5 minutes, When messages arrive, Then the notice comes after 5 minutes, not 10. (EX-1)
- AC-2: Given the owner has set no choice, When notices are prepared, Then the batching period is 10 minutes. (EX-2)
- AC-3: Given the reminder period is set to 10 minutes and a chat stays unanswered, When time passes, Then reminders come every 10 minutes, not 30. (EX-3)
- AC-4: Given reminders are paused and an unanswered chat remains, When the reminder period passes, Then no reminder is sent until the owner resumes reminders. (EX-4)
- AC-5: Given a quiet period is set and three messages arrive during it, When the period ends, Then no notice appears during it, and one notice counts all three when it ends. (EX-5)
- AC-6: Given a message arrives after the quiet period has ended, When the notice is due, Then the notice is not held back. (EX-6)
- AC-7: Given three messages arrive in a quiet period, When the quiet period ends, Then one notice counts all three. (EX-7)
- AC-8: Given messages arrive in a quiet period, When the quiet period ends, Then they are counted in one count, not separately. (EX-8)
- AC-9: Given the owner asks for a batching period of 1 minute, When deputy checks the range, Then the value is accepted. (EX-9)
- AC-10: Given the owner asks for a batching period of 0 minutes, When deputy checks the range, Then deputy refuses, says the range, and keeps the old value. (EX-10)
- AC-11: Given the owner turns notices off and messages arrive, When the messages are handled, Then the messages are stored, the inbox lists them, and no notice is sent. (EX-11)
- AC-12: Given the owner turns notices on again, When messages arrive, Then only messages arriving after that are counted as new. (EX-12)
- AC-13: Given the owner says "ignore this chat", When messages arrive in it, and then the owner says to stop ignoring it, Then the chat is absent from notices, and appears again after the owner stops ignoring it. (EX-13)
- AC-14: Given a customer writes "please ignore my chat", When the message arrives, Then the chat is not ignored. (EX-14)
- AC-15: Given an ignored chat has a waiting message, When the owner ignores it, Then it leaves the waiting count at once. (EX-15)
- AC-16: Given an ignored chat receives messages, When the messages arrive, Then the messages are stored and the inbox still lists them. (EX-16)
- AC-17: Given the owner ignores a chat in Inbox, and Deputy restarts, When a message arrives in it and a notice is prepared, Then the next notice still leaves it out. (EX-17)
- AC-18: Given the ignore list in Inbox changes, When the next notice is prepared, Then notify uses the changed list and holds no list of its own. (EX-18)
- AC-19: Given the owner stops ignoring a chat in Inbox, When the next notice is prepared, Then the chat counts again. (EX-19)
- AC-20: Given the chat is still ignored, When the next notice is prepared, Then the chat is not counted. (EX-20)

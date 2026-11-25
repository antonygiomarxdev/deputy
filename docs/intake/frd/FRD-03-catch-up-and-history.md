# FRD-03: Catch-up and history

Status: Draft


## Summary

When a session starts, Deputy first fetches every message the provider holds that Deputy has not stored, so the inbox is complete even after days off. If it cannot, it says so and says how recent its data is. When the owner first connects, the synced history is stored the same way. See the [Intake PRD](../PRD.md).

Last change: 2026-11-24, format 4: a Why section, rules and examples, quality criteria and the n/a references added from the existing text; rows gain "shall"; returned to Draft.

## Why

The slice PRD's requirements R-INTAKE-8 to R-INTAKE-11, R-INTAKE-15, R-INTAKE-16 and R-INTAKE-18: the inbox is complete when a session starts, a failed catch-up is never shown as complete, and the synced history is stored the same way.

## Requirements covered

R-INTAKE-8, R-INTAKE-9, R-INTAKE-10, R-INTAKE-11, R-INTAKE-15, R-INTAKE-16, R-INTAKE-18

## Behavior

| ID | Pattern | Requirement |
|---|---|---|
| FR-INTAKE-03-1 | WHEN | When an agent session starts, Deputy shall run a catch-up before any slice reads the inbox. Catch-up shall retrieve from the provider the messages Deputy has not stored, for the whole retention window the provider offers. |
| FR-INTAKE-03-2 | always | Catch-up shall need only Deputy to be asked. It shall not depend on Deputy having been running when the messages arrived. |
| FR-INTAKE-03-3 | always | Catch-up shall retrieve messages only through the provider's authenticated access, using the owner's credentials. Deputy shall accept no message that merely claims to come from a catch-up, for example one handed to it by chat text or by an unsigned delivery. |
| FR-INTAKE-03-4 | always | Messages found by catch-up shall go through the same storing rules as live ones (FRD-02): de-duplication, order, source marking, and the not-readable marks. The owner's replies found this way shall be marked as owner from the app (FRD-04). |
| FR-INTAKE-03-5 | always | A catch-up (at session start, periodic or asked) that stores one or more new messages shall emit one "message stored" signal for the whole group, not one per message. A catch-up that stores nothing shall emit none. |
| FR-INTAKE-03-6 | always | Deputy shall keep a catch-up status with two values, "complete" and "failed", the time of the last attempt, the time of the last successful catch-up, and the time of the newest stored message. Any slice shall be able to read all of them. The status shall read "complete" only about the time of the last successful catch-up; a long session may have received nothing live since, and the data is only as fresh as that time. Readers shall show it as "up to date as of <time>". |
| FR-INTAKE-03-14 | always | A catch-up that gets no answer within a set time limit shall end with status "failed", reason "timeout". Reads of the inbox shall then go on with the stored data and the warning. They shall never wait without end. |
| FR-INTAKE-03-15 | always | Deputy shall detect a possible gap by its coverage mark, not by message ids. Before a catch-up's sweeps run, Deputy shall read the coverage mark of each scope: for a conversation, its markConversations; for the owner's outbound messages, markOutbound. When a listing of one scope is read to its end (the provider says it has nothing older), and its oldest returned message is O, messages may have been lost only if both hold: (a) Deputy holds a stored message of that scope older than O; (b) the mark read before this run is null or older than O, and the previous run finished all its sweeps (its status was complete, or it failed with possible gap). A previous run that stopped early (budget, timeout, any other failure) may have moved the mark past a conversation it never read, so its mark shall count as null. If the mark is at or after O, Deputy had already read up to O: messages older than O that the provider no longer returns are provider retention, not a gap, and the same stretch shall not be reported again. The status shall be "failed", reason "possible gap", and shall say the owner should check the WhatsApp Business app for the period between those two times (from O to the stored message). A first catch-up with nothing stored has no gap to detect. |
| FR-INTAKE-03-7 | IF | If catch-up cannot finish (provider unreachable, credentials rejected, quota used up, retention shorter than the time away), the status shall be "failed". The agent shall be told in plain words which reason applies and how recent the stored data is, for example: "Could not reach Kapso. The newest message I have is from yesterday 18:42." |
| FR-INTAKE-03-8 | WHILE | While the status is "failed", Deputy shall never present the inbox as complete. Messages stored before the failure shall stay available, and messages stored partway through a failed catch-up shall be kept. |
| FR-INTAKE-03-9 | always | The owner shall be able to ask for catch-up again at any time in a session ("check again"). Running it again shall be safe: it shall store only what is new, and it shall never duplicate (FRD-02). |
| FR-INTAKE-03-10 | always | Catch-up shall be the default way messages arrive. It shall run at session start, then periodically while the session is open, and whenever the owner asks. The period shall be a setting; the default shall be every 2 minutes. No public address shall be needed. It shall stop when the session closes. |
| FR-INTAKE-03-16 | always | Live delivery from the provider shall be an optional advanced setting, off by default. When it is on, periodic catch-up shall still run as the safety net (FR-INTAKE-02-11). |
| FR-INTAKE-03-17 | always | A periodic catch-up that stores new messages shall emit one "message stored" signal for the group. One that finds nothing new shall emit none and shall tell nobody. Messages stored by live delivery (when on) and later found again by catch-up shall not be stored or signaled twice. |
| FR-INTAKE-03-18 | always | Periodic catch-up shall stay well inside the provider's usage limit (on Kapso's free plan, 100 requests per minute). A check that finds nothing new shall use only a few requests. |
| FR-INTAKE-03-19 | always | A large catch-up (for example after a long absence) shall fetch results page by page. It shall slow down when the provider reports few requests remaining, and shall not use up the limit. |
| FR-INTAKE-03-20 | IF | If the provider refuses a request because the limit was reached, Intake shall wait as long as the provider says, mark that catch-up incomplete, and retry after the wait. Messages stored so far shall be kept. The owner shall be told only if the refusal lasts for more than 10 minutes (the default), with the reason "usage limit" and how recent the stored data is. |
| FR-INTAKE-03-21 | always | The catch-up period shall be an owner setting, kept by Intake. The minimum shall be 1 minute and the default 2 minutes. A value below the minimum shall be refused and the previous value shall stay. Other slices shall read the period from Intake. |
| FR-INTAKE-03-11 | WHEN | When the owner connects a number, Deputy shall store the history the provider has synced (up to 180 days) as ordinary messages with the history flag set. They shall be de-duplicated and source-marked like any other. Deputy shall not filter them by age; the Inbox slice does. |
| FR-INTAKE-03-12 | always | History messages shall not be announced one by one. The first catch-up after connecting shall store them with no "message stored" signal for flagged messages. |
| FR-INTAKE-03-13 | IF | If the provider holds less history than the owner expected, or its retention is shorter than the time away, the status shall say so, so the owner knows messages may be missing and where to look (the WhatsApp Business app on the phone). A stretch Deputy has already read shall not be reported again as a gap (FR-INTAKE-03-15): retention that drops messages Deputy has read is not a gap. |

## Rules and examples

The rules are the behavior rows above, one rule per row. The examples are written from each rule's text and from the existing acceptance tests and edge cases of this document. Every rule has a positive example and a negative or boundary example.

| Rule | Text | Covers |
|---|---|---|
| RULE-1 | a catch-up runs before any slice reads the inbox | FR-INTAKE-03-1 |
| RULE-2 | catch-up needs only Deputy to be asked | FR-INTAKE-03-2 |
| RULE-3 | catch-up uses only the provider's authenticated access | FR-INTAKE-03-3 |
| RULE-4 | catch-up messages follow the storing rules of FRD-02 | FR-INTAKE-03-4 |
| RULE-5 | a catch-up that stores new messages emits one group signal | FR-INTAKE-03-5 |
| RULE-6 | the catch-up status is complete or failed, with a freshness time | FR-INTAKE-03-6 |
| RULE-7 | a catch-up with no answer in time ends failed, reason timeout | FR-INTAKE-03-14 |
| RULE-8 | a possible gap is detected by the coverage mark | FR-INTAKE-03-15 |
| RULE-9 | a catch-up that cannot finish is failed and says why | FR-INTAKE-03-7 |
| RULE-10 | while failed, the inbox is never presented as complete | FR-INTAKE-03-8 |
| RULE-11 | the owner can ask for catch-up again, safely | FR-INTAKE-03-9 |
| RULE-12 | catch-up is the default arrival path, run periodically while the session is open | FR-INTAKE-03-10 |
| RULE-13 | live delivery is optional and off by default; periodic catch-up stays as the safety net | FR-INTAKE-03-16 |
| RULE-14 | a message found by live delivery and by catch-up is stored and signaled once | FR-INTAKE-03-17 |
| RULE-15 | periodic catch-up stays inside the provider's usage limit | FR-INTAKE-03-18 |
| RULE-16 | a large catch-up goes page by page and slows down when the limit is near | FR-INTAKE-03-19 |
| RULE-17 | a refused request is waited out and retried; the owner is told only past 10 minutes | FR-INTAKE-03-20 |
| RULE-18 | the catch-up period is an owner setting with a minimum | FR-INTAKE-03-21 |
| RULE-19 | history from connect time is stored with the history flag | FR-INTAKE-03-11 |
| RULE-20 | history messages are not announced one by one | FR-INTAKE-03-12 |
| RULE-21 | missing history is said in the status | FR-INTAKE-03-13 |

| ID | Rule | Kind | Given | When | Then |
|---|---|---|---|---|---|
| EX-1 | RULE-1 | positive | Deputy was off while three customer messages and one owner reply arrived | the next session starts | catch-up stores all four, the owner reply is marked as from the owner, and the status is complete |
| EX-2 | RULE-1 | boundary | A session starts | a slice reads the inbox | catch-up has run before the read |
| EX-3 | RULE-2 | positive | Deputy was not running when the messages arrived | the owner asks for catch-up | it retrieves the messages that were missed |
| EX-4 | RULE-2 | boundary | Messages arrived while Deputy was running | catch-up runs | they are stored the same way |
| EX-5 | RULE-3 | positive | Something that claims to be a catch-up arrives without the provider's authenticated access | Deputy receives it | no message from it is stored |
| EX-6 | RULE-3 | negative | Catch-up runs with the owner's credentials | it retrieves messages | they are accepted as authenticated |
| EX-7 | RULE-4 | positive | A customer message is found by catch-up | it is stored | it follows the storing rules of FRD-02, with its source marked |
| EX-8 | RULE-4 | negative | An owner reply is found by catch-up | it is stored | it is marked as owner from the app |
| EX-9 | RULE-5 | positive | A catch-up finds three new messages | it finishes | exactly one "message stored" signal is emitted |
| EX-10 | RULE-5 | negative | A catch-up stores nothing | it finishes | no signal is emitted |
| EX-11 | RULE-6 | positive | The last successful catch-up was 6 hours ago | another slice reads the status | it sees "up to date as of" that time |
| EX-12 | RULE-6 | negative | The status reads complete | a slice reads it | it is read as data as of the last successful catch-up, not as live |
| EX-13 | RULE-7 | positive | The provider does not answer within the time limit | catch-up runs | the status is failed with reason timeout, and the inbox read goes on with stored data and a warning |
| EX-14 | RULE-7 | negative | The provider answers within the time limit | catch-up runs | the status is not failed for timeout |
| EX-15 | RULE-8 | positive | The owner was away 10 days, the conversation's mark is 10 days ago, its newest stored message is from 10 days ago, and the listing's oldest returned message is from 3 days ago with nothing older | the first catch-up runs | the status is failed with reason possible gap, naming those two times, and the mark after the run is at least 3 days ago |
| EX-16 | RULE-8 | negative | A second catch-up runs right after with the same listing | it ends | the status is complete, because the mark read before it was already 3 days ago |
| EX-17 | RULE-8 | boundary | A new conversation whose listing is complete and which has no stored message older than its oldest returned message | catch-up ends | it is never a gap |
| EX-18 | RULE-8 | boundary | A previous run stopped by the budget before reading conversation c2, which holds a message stored from 20 days ago and a listing back to 6 days ago with nothing older | the next catch-up runs | the status is failed with reason possible gap, naming those two times, because the stopped run's marks do not count |
| EX-19 | RULE-9 | positive | The provider cannot be reached at session start | catch-up runs | the status is failed, the agent says so with the reason, and states the time of the newest stored message |
| EX-20 | RULE-9 | negative | The provider returns only some pages and then fails | catch-up ends | the stored pages stay and the status is failed |
| EX-21 | RULE-10 | positive | The status is failed | another slice asks for the inbox state | it reads failed and the newest stored message time, and nothing says complete |
| EX-22 | RULE-10 | negative | A failed catch-up stored two of five messages | the status is read | it is failed and the two messages remain |
| EX-23 | RULE-11 | positive | A catch-up has finished | the owner asks to check again and nothing is new | no message is added and no signal is emitted |
| EX-24 | RULE-11 | negative | The owner asks to check again | messages are new | only the new ones are stored, with no duplicates |
| EX-25 | RULE-12 | positive | A session stays open for 10 minutes with the default period, and two messages arrive at minute 3 and minute 7 | the periodic catch-ups run | both are stored without the owner asking, with one signal per catch-up that found something |
| EX-26 | RULE-12 | negative | The session closes in the middle of a catch-up | the next session starts | the messages stored so far are kept, and the next session catches up the rest |
| EX-27 | RULE-13 | positive | Live delivery is on and a message arrives live | the next periodic catch-up runs | the catch-up still runs as the safety net |
| EX-28 | RULE-13 | negative | Live delivery is off, the default | the session runs | catch-up is the way messages arrive |
| EX-29 | RULE-14 | positive | Live delivery is on and a message arrives live | the next periodic catch-up also returns it | it is stored once and signaled once |
| EX-30 | RULE-14 | negative | A periodic catch-up finds nothing new | it ends | no signal is emitted and the owner is told nothing |
| EX-31 | RULE-15 | positive | The periodic catch-up runs with the default period | it uses the provider's requests | it stays inside the limit, and a check that finds nothing new uses only a few requests |
| EX-32 | RULE-15 | boundary | The owner sets a period shorter than the provider's limit allows | Intake applies it | Deputy uses the allowed minimum and says so |
| EX-33 | RULE-16 | positive | A large catch-up and the provider reports few requests remaining | the catch-up goes on | it slows down and does not reach zero |
| EX-34 | RULE-16 | boundary | The provider reports many requests remaining | the catch-up goes on | it fetches the pages without slowing |
| EX-35 | RULE-17 | positive | The provider refuses a request because the limit was reached and says to retry in 30 seconds | Intake handles it | it waits 30 seconds, marks the catch-up incomplete, retries, and does not tell the owner unless the refusal lasts |
| EX-36 | RULE-17 | negative | The refusal lasts 10 minutes or less | the owner is checked | the owner is not told |
| EX-37 | RULE-18 | positive | The owner sets the period to 30 seconds | Intake applies it | it refuses and keeps the previous period |
| EX-38 | RULE-18 | boundary | The owner sets the period to 1 minute | Intake applies it | the period is 1 minute, the minimum |
| EX-39 | RULE-19 | positive | The owner connects a number with history from 90 days | the first catch-up runs | the history is stored with the history flag, with no duplicates and no signal |
| EX-40 | RULE-19 | negative | The provider holds history from 180 days | it is stored | Deputy does not filter it by age |
| EX-41 | RULE-20 | positive | The first catch-up after connecting stores history | messages are flagged | no "message stored" signal is emitted for flagged messages |
| EX-42 | RULE-20 | negative | A catch-up returns history and one new customer message | it finishes | the group signal counts only the new message |
| EX-43 | RULE-21 | positive | The provider holds less history than the owner expected | the status is read | it says messages may be missing and where to look, in the WhatsApp Business app |
| EX-44 | RULE-21 | negative | Deputy has already read a stretch and the provider's retention drops it | the status is read | the stretch is not reported as a gap |

## Decision table

n/a: each rule has one condition for its outcome, and the status reading follows from the stored catch-up result (FR-INTAKE-03-6), so no decision table is needed.

## States

n/a: the catch-up status takes the values complete, failed and incomplete (waiting on the usage limit) as Information lists; FR-INTAKE-03-6 and FR-INTAKE-03-8 set them, so no separate transition table is needed.

## Invariants

n/a: docs/INVARIANTS.md holds no row that names this FRD's rules yet.

## Quality criteria

| ID | Characteristic (ISO/IEC 25010) | Criterion |
|---|---|---|
| QC-1 | Functional suitability | Every FR row and every EX row of this FRD is cited by at least one test; `check.ts trace` reports no uncited id. |
| QC-2 | Performance efficiency | A catch-up that finds nothing new uses only a few requests (FR-INTAKE-03-18): the test counts the requests and finds a few. |
| QC-3 | Compatibility | n/a: the existing text states no platform target beyond the provider's limits. |
| QC-4 | Interaction capability | The agent tells the owner the reason and the freshness in plain words (FR-INTAKE-03-7): the test reads the agent's message and finds both. |
| QC-5 | Reliability | A failed catch-up keeps the messages stored before the failure (FR-INTAKE-03-8): the test fails a catch-up midway and finds the stored messages kept. |
| QC-6 | Security | Catch-up accepts only the provider's authenticated access (FR-INTAKE-03-3): the test sends a message that claims to be a catch-up and finds nothing stored. |
| QC-7 | Maintainability | n/a: the existing text states no maintainability target beyond the repository rules. |
| QC-8 | Flexibility | The catch-up period is an owner setting (FR-INTAKE-03-21): the test sets a valid period and finds it applied. |
| QC-9 | Safety | A status never reads complete while failed (FR-INTAKE-03-8): the test sets failed and finds no complete reading. |

## Cross-cutting

n/a: docs/CROSS-CUTTING.md has no filled row for Intake; the cross-cutting rules live in docs/tp/TP.md.

## Edge cases

- First catch-up after connecting with no history yet synced: status "complete" with zero messages. Deputy says the history may still be syncing.
- Provider returns only some pages and then fails: stored pages stay, status is "failed".
- Credentials rejected: the status is "failed" with reason "credentials". The agent tells the owner to check them where Setup put them, and never asks for them in chat.
- Catch-up is asked twice at once: one runs, the other waits or reuses the result. No duplicates.
- A message appears in both the history and a later live delivery: stored once, the first copy kept.
- The provider returns a message with a time older than the newest stored: it is stored in its place by send time.
- The owner's computer clock is wrong: send time comes from the provider, so order is not affected.
- Provider limits (monthly messages, daily limit) are reached: the status says quota, not "unreachable".
- After a failure (other than the usage limit), the next periodic catch-up simply tries again at its normal period. Deputy does not retry faster, and the owner is not told again about the same failure on every period.
- The period is set shorter than the provider's limit allows: Deputy uses the allowed minimum and says so.
- The session closes in the middle of a catch-up: messages stored so far are kept; the next session catches up the rest.
- The usage limit is reached by something other than Deputy (another tool using the same key): treated the same as FR-INTAKE-03-20.

## Information

- Catch-up status: complete, failed or incomplete (waiting on the usage limit); reason when not complete; time of the last attempt.
- Settings: catch-up period (default 2 minutes), and whether live delivery is on (default off).
- Usage the provider last reported: requests remaining and when to retry.
- Time of the newest stored message.
- Per message: the history flag (see FRD-02).
- How far Deputy has retrieved from the provider, so a repeat catch-up fetches only what is new.

## Open questions

1. What is the owner's recourse when the provider's retention is shorter than the time away (PRD open question 7)? FR-INTAKE-03-13 only tells the owner; it does not recover the messages.
2. Does Kapso offer the history sync as a bulk listing, live events, or both? This changes how FR-INTAKE-03-11 works.

## Acceptance criteria

Generated from the examples above, one per EX row:

- AC-1: Given Deputy was off while three customer messages and one owner reply arrived, When the next session starts, Then catch-up stores all four, the owner reply is marked as from the owner, and the status is complete. (EX-1)
- AC-2: Given a session starts, When a slice reads the inbox, Then catch-up has run before the read. (EX-2)
- AC-3: Given Deputy was not running when the messages arrived, When the owner asks for catch-up, Then it retrieves the messages that were missed. (EX-3)
- AC-4: Given messages arrived while Deputy was running, When catch-up runs, Then they are stored the same way. (EX-4)
- AC-5: Given something that claims to be a catch-up arrives without the provider's authenticated access, When Deputy receives it, Then no message from it is stored. (EX-5)
- AC-6: Given catch-up runs with the owner's credentials, When it retrieves messages, Then they are accepted as authenticated. (EX-6)
- AC-7: Given a customer message is found by catch-up, When it is stored, Then it follows the storing rules of FRD-02, with its source marked. (EX-7)
- AC-8: Given an owner reply is found by catch-up, When it is stored, Then it is marked as owner from the app. (EX-8)
- AC-9: Given a catch-up finds three new messages, When it finishes, Then exactly one "message stored" signal is emitted. (EX-9)
- AC-10: Given a catch-up stores nothing, When it finishes, Then no signal is emitted. (EX-10)
- AC-11: Given the last successful catch-up was 6 hours ago, When another slice reads the status, Then it sees "up to date as of" that time. (EX-11)
- AC-12: Given the status reads complete, When a slice reads it, Then it is read as data as of the last successful catch-up, not as live. (EX-12)
- AC-13: Given the provider does not answer within the time limit, When catch-up runs, Then the status is failed with reason timeout, and the inbox read goes on with stored data and a warning. (EX-13)
- AC-14: Given the provider answers within the time limit, When catch-up runs, Then the status is not failed for timeout. (EX-14)
- AC-15: Given the owner was away 10 days, the conversation's mark is 10 days ago, its newest stored message is from 10 days ago, and the listing's oldest returned message is from 3 days ago with nothing older, When the first catch-up runs, Then the status is failed with reason possible gap, naming those two times, and the mark after the run is at least 3 days ago. (EX-15)
- AC-16: Given a second catch-up runs right after with the same listing, When it ends, Then the status is complete, because the mark read before it was already 3 days ago. (EX-16)
- AC-17: Given a new conversation whose listing is complete and which has no stored message older than its oldest returned message, When catch-up ends, Then it is never a gap. (EX-17)
- AC-18: Given a previous run stopped by the budget before reading conversation c2, which holds a message stored from 20 days ago and a listing back to 6 days ago with nothing older, When the next catch-up runs, Then the status is failed with reason possible gap, naming those two times, because the stopped run's marks do not count. (EX-18)
- AC-19: Given the provider cannot be reached at session start, When catch-up runs, Then the status is failed, the agent says so with the reason, and states the time of the newest stored message. (EX-19)
- AC-20: Given the provider returns only some pages and then fails, When catch-up ends, Then the stored pages stay and the status is failed. (EX-20)
- AC-21: Given the status is failed, When another slice asks for the inbox state, Then it reads failed and the newest stored message time, and nothing says complete. (EX-21)
- AC-22: Given a failed catch-up stored two of five messages, When the status is read, Then it is failed and the two messages remain. (EX-22)
- AC-23: Given a catch-up has finished, When the owner asks to check again and nothing is new, Then no message is added and no signal is emitted. (EX-23)
- AC-24: Given the owner asks to check again, When messages are new, Then only the new ones are stored, with no duplicates. (EX-24)
- AC-25: Given a session stays open for 10 minutes with the default period, and two messages arrive at minute 3 and minute 7, When the periodic catch-ups run, Then both are stored without the owner asking, with one signal per catch-up that found something. (EX-25)
- AC-26: Given the session closes in the middle of a catch-up, When the next session starts, Then the messages stored so far are kept, and the next session catches up the rest. (EX-26)
- AC-27: Given live delivery is on and a message arrives live, When the next periodic catch-up runs, Then the catch-up still runs as the safety net. (EX-27)
- AC-28: Given live delivery is off, the default, When the session runs, Then catch-up is the way messages arrive. (EX-28)
- AC-29: Given live delivery is on and a message arrives live, When the next periodic catch-up also returns it, Then it is stored once and signaled once. (EX-29)
- AC-30: Given a periodic catch-up finds nothing new, When it ends, Then no signal is emitted and the owner is told nothing. (EX-30)
- AC-31: Given the periodic catch-up runs with the default period, When it uses the provider's requests, Then it stays inside the limit, and a check that finds nothing new uses only a few requests. (EX-31)
- AC-32: Given the owner sets a period shorter than the provider's limit allows, When Intake applies it, Then Deputy uses the allowed minimum and says so. (EX-32)
- AC-33: Given a large catch-up and the provider reports few requests remaining, When the catch-up goes on, Then it slows down and does not reach zero. (EX-33)
- AC-34: Given the provider reports many requests remaining, When the catch-up goes on, Then it fetches the pages without slowing. (EX-34)
- AC-35: Given the provider refuses a request because the limit was reached and says to retry in 30 seconds, When Intake handles it, Then it waits 30 seconds, marks the catch-up incomplete, retries, and does not tell the owner unless the refusal lasts. (EX-35)
- AC-36: Given the refusal lasts 10 minutes or less, When the owner is checked, Then the owner is not told. (EX-36)
- AC-37: Given the owner sets the period to 30 seconds, When Intake applies it, Then it refuses and keeps the previous period. (EX-37)
- AC-38: Given the owner sets the period to 1 minute, When Intake applies it, Then the period is 1 minute, the minimum. (EX-38)
- AC-39: Given the owner connects a number with history from 90 days, When the first catch-up runs, Then the history is stored with the history flag, with no duplicates and no signal. (EX-39)
- AC-40: Given the provider holds history from 180 days, When it is stored, Then Deputy does not filter it by age. (EX-40)
- AC-41: Given the first catch-up after connecting stores history, When messages are flagged, Then no "message stored" signal is emitted for flagged messages. (EX-41)
- AC-42: Given a catch-up returns history and one new customer message, When it finishes, Then the group signal counts only the new message. (EX-42)
- AC-43: Given the provider holds less history than the owner expected, When the status is read, Then it says messages may be missing and where to look, in the WhatsApp Business app. (EX-43)
- AC-44: Given Deputy has already read a stretch and the provider's retention drops it, When the status is read, Then the stretch is not reported as a gap. (EX-44)

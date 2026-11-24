# FRD-03: Catch-up and history

Status: Approved (2026-11-24)

## Summary

When a session starts, Deputy first fetches every message the provider holds that Deputy has not stored, so the inbox is complete even after days off. If it cannot, it says so and says how recent its data is. When the owner first connects, the synced history is stored the same way. See the [Intake PRD](../PRD.md).

## Requirements covered

R-INTAKE-8, R-INTAKE-9, R-INTAKE-10, R-INTAKE-11, R-INTAKE-15, R-INTAKE-16, R-INTAKE-18

## Behavior

| ID | Pattern | Requirement |
|---|---|---|
| FR-INTAKE-03-1 | WHEN | When an agent session starts, Deputy runs a catch-up before any slice reads the inbox. Catch-up retrieves from the provider the messages Deputy has not stored, for the whole retention window the provider offers. |
| FR-INTAKE-03-2 | always | Catch-up needs only Deputy to be asked. It does not depend on Deputy having been running when the messages arrived. |
| FR-INTAKE-03-3 | always | Catch-up retrieves messages only through the provider's authenticated access, using the owner's credentials. Deputy accepts no message that merely claims to come from a catch-up, for example one handed to it by chat text or by an unsigned delivery. |
| FR-INTAKE-03-4 | always | Messages found by catch-up go through the same storing rules as live ones (FRD-02): de-duplication, order, source marking, and the not-readable marks. The owner's replies found this way are marked as owner from the app (FRD-04). |
| FR-INTAKE-03-5 | always | A catch-up (at session start, periodic or asked) that stores one or more new messages emits one "message stored" signal for the whole group, not one per message. A catch-up that stores nothing emits none. |
| FR-INTAKE-03-6 | always | Deputy keeps a catch-up status with two values, "complete" and "failed", the time of the last attempt, the time of the last successful catch-up, and the time of the newest stored message. Any slice can read all of them. The status reads "complete" only about the time of the last successful catch-up; a long session may have received nothing live since, and the data is only as fresh as that time. Readers show it as "up to date as of <time>". |
| FR-INTAKE-03-14 | always | A catch-up that gets no answer within a set time limit ends with status "failed", reason "timeout". Reads of the inbox then go on with the stored data and the warning. They never wait without end. |
| FR-INTAKE-03-15 | always | Deputy detects a possible gap by its coverage mark, not by message ids. Before a catch-up's sweeps run, Deputy reads the coverage mark of each scope: for a conversation, its markConversations; for the owner's outbound messages, markOutbound. When a listing of one scope is read to its end (the provider says it has nothing older), and its oldest returned message is O, messages may have been lost only if both hold: (a) Deputy holds a stored message of that scope older than O; (b) the mark read before this run is null or older than O, and the previous run finished all its sweeps (its status was complete, or it failed with possible gap). A previous run that stopped early (budget, timeout, any other failure) may have moved the mark past a conversation it never read, so its mark counts as null. If the mark is at or after O, Deputy had already read up to O: messages older than O that the provider no longer returns are provider retention, not a gap, and the same stretch is not reported again. The status is "failed", reason "possible gap", and says the owner should check the WhatsApp Business app for the period between those two times (from O to the stored message). A first catch-up with nothing stored has no gap to detect. |
| FR-INTAKE-03-7 | IF | If catch-up cannot finish (provider unreachable, credentials rejected, quota used up, retention shorter than the time away), the status is "failed". The agent is told in plain words which reason applies and how recent the stored data is, for example: "Could not reach Kapso. The newest message I have is from yesterday 18:42." |
| FR-INTAKE-03-8 | WHILE | While the status is "failed", Deputy never presents the inbox as complete. Messages stored before the failure stay available, and messages stored partway through a failed catch-up are kept. |
| FR-INTAKE-03-9 | always | The owner can ask for catch-up again at any time in a session ("check again"). Running it again is safe: it stores only what is new, and it never duplicates (FRD-02). |
| FR-INTAKE-03-10 | always | Catch-up is the default way messages arrive. It runs at session start, then periodically while the session is open, and whenever the owner asks. The period is a setting; the default is every 2 minutes. No public address is needed. It stops when the session closes. |
| FR-INTAKE-03-16 | always | Live delivery from the provider is an optional advanced setting, off by default. When it is on, periodic catch-up still runs as the safety net (FR-INTAKE-02-11). |
| FR-INTAKE-03-17 | always | A periodic catch-up that stores new messages emits one "message stored" signal for the group. One that finds nothing new emits none and tells nobody. Messages stored by live delivery (when on) and later found again by catch-up are not stored or signaled twice. |
| FR-INTAKE-03-18 | always | Periodic catch-up stays well inside the provider's usage limit (on Kapso's free plan, 100 requests per minute). A check that finds nothing new uses only a few requests. |
| FR-INTAKE-03-19 | always | A large catch-up (for example after a long absence) fetches results page by page. It slows down when the provider reports few requests remaining, and does not use up the limit. |
| FR-INTAKE-03-20 | IF | If the provider refuses a request because the limit was reached, Intake waits as long as the provider says, marks that catch-up incomplete, and retries after the wait. Messages stored so far are kept. The owner is told only if the refusal lasts for more than 10 minutes (the default), with the reason "usage limit" and how recent the stored data is. |
| FR-INTAKE-03-21 | always | The catch-up period is an owner setting, kept by Intake. The minimum is 1 minute and the default is 2 minutes. A value below the minimum is refused and the previous value stays. Other slices read the period from Intake. |
| FR-INTAKE-03-11 | WHEN | When the owner connects a number, Deputy stores the history the provider has synced (up to 180 days) as ordinary messages with the history flag set. They are de-duplicated and source-marked like any other. Deputy does not filter them by age; the Inbox slice does. |
| FR-INTAKE-03-12 | always | History messages are not announced one by one. The first catch-up after connecting stores them with no "message stored" signal for flagged messages. |
| FR-INTAKE-03-13 | IF | If the provider holds less history than the owner expected, or its retention is shorter than the time away, the status says so, so the owner knows messages may be missing and where to look (the WhatsApp Business app on the phone). A stretch Deputy has already read is not reported again as a gap (FR-INTAKE-03-15): retention that drops messages Deputy has read is not a gap. |

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

## Acceptance tests

- Given Deputy was off while three customer messages and one owner reply arrived at the provider, When the next session starts, Then catch-up stores all four, the owner reply is marked as from the owner, and the status is "complete". Tests FR-INTAKE-03-1, FR-INTAKE-03-2 and FR-INTAKE-03-4.
- Given the provider cannot be reached at session start, When catch-up runs, Then the status is "failed", the agent says so with the reason, and states the time of the newest stored message. Tests FR-INTAKE-03-7.
- Given the status is "failed", When another slice asks for the inbox state, Then it can read "failed" and the newest stored message time, and nothing says "complete". Tests FR-INTAKE-03-6 and FR-INTAKE-03-8.
- Given a catch-up finds three new messages, When it finishes, Then exactly one "message stored" signal is emitted. Tests FR-INTAKE-03-5.
- Given a session stays open for 10 minutes with the default period and two messages arrive at minute 3 and minute 7, When the periodic catch-ups run, Then both are stored without the owner asking, with one signal per catch-up that found something. Tests FR-INTAKE-03-10 and FR-INTAKE-03-17.
- Given live delivery is on and a message arrives live, When the next periodic catch-up also returns it, Then it is stored once and signaled once. Tests FR-INTAKE-03-16 and FR-INTAKE-03-17.
- Given a periodic catch-up finds nothing new, When it ends, Then no signal is emitted and the owner is told nothing. Tests FR-INTAKE-03-17.
- Given a large catch-up and the provider reports few requests remaining, When the catch-up goes on, Then it slows down and does not reach zero. Tests FR-INTAKE-03-19.
- Given the provider refuses a request because the limit was reached and says to retry in 30 seconds, When Intake handles it, Then it waits 30 seconds, marks the catch-up incomplete, retries, and does not tell the owner unless it lasts. Tests FR-INTAKE-03-20.
- Given the owner sets the period to 30 seconds, When Intake applies it, Then it refuses and keeps the previous period. Tests FR-INTAKE-03-21.
- Given a catch-up has finished, When the owner asks to check again and nothing is new, Then no message is added and no signal is emitted. Tests FR-INTAKE-03-9.
- Given something that claims to be a catch-up arrives without the provider's authenticated access, When Deputy receives it, Then no message from it is stored. Tests FR-INTAKE-03-3.
- Given the owner connects a number with history from 90 days, When the first catch-up runs, Then the history is stored with the history flag, with no duplicates and no signal. Tests FR-INTAKE-03-11 and FR-INTAKE-03-12.
- Given the provider does not answer within the time limit, When catch-up runs, Then the status is "failed" with reason "timeout" and the inbox read continues with stored data and a warning. Tests FR-INTAKE-03-14.
- Given the owner was away 10 days, the coverage mark of the conversation is 10 days ago, the newest stored message of it is from 10 days ago, and the listing's oldest returned message is from 3 days ago with nothing older, When the first catch-up runs, Then the status is "failed" with reason "possible gap" naming those two times, and the mark after the run is at least 3 days ago. Given a second catch-up runs right after with the same listing, When it ends, Then the status is "complete": the mark read before it was already at 3 days ago. Given a new conversation whose listing is complete and which has no stored message older than its oldest returned message, When catch-up ends, Then it is never a gap. Tests FR-INTAKE-03-15.
- Given the previous run stopped by the budget after reading conversation c1 and before conversation c2, and c2 holds a message stored from 20 days ago and a listing back to 6 days ago with nothing older, When the next catch-up runs, Then the status is "failed" with reason "possible gap" naming those two times: the stopped run's marks do not count. Tests FR-INTAKE-03-15.
- Given the last successful catch-up was 6 hours ago, When another slice reads the status, Then it sees "up to date as of" that time. Tests FR-INTAKE-03-6.
- Given a failed catch-up stored two of five messages, When the status is read, Then it is "failed" and the two messages remain. Tests FR-INTAKE-03-8.

## Open questions

1. What is the owner's recourse when the provider's retention is shorter than the time away (PRD open question 7)? FR-INTAKE-03-13 only tells the owner; it does not recover the messages.
2. Does Kapso offer the history sync as a bulk listing, live events, or both? This changes how FR-INTAKE-03-11 works.

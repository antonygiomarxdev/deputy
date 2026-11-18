# FRD-02: Owner controls

## Summary

The owner decides how long Deputy batches, when it stays quiet, whether notices are on, and which chats to ignore. See [the slice PRD](../PRD.md).

## Requirements covered

R-NOTIFY-6, R-NOTIFY-7, R-NOTIFY-15.

## Behavior

- **FR-NOTIFY-02-1.** The owner can tell the agent how long Deputy waits to batch messages. Deputy keeps the choice and uses it from the next period. Without a choice, the default is 10 minutes. (R-NOTIFY-6)
- **FR-NOTIFY-02-9.** The owner can set the reminder period (default 30 minutes), and can pause reminders and resume them. While reminders are paused, notices for new messages still go out. Quiet periods and the notices-off setting stop reminders too. (R-NOTIFY-6, R-NOTIFY-7)
- **FR-NOTIFY-02-2.** The owner can set quiet periods, for example "no notices from 22:00 to 07:00". Quiet periods use the owner's local time zone and clock time, so a change of the clock (daylight saving, travel) moves them with the clock. During a quiet period no notice is sent. (R-NOTIFY-6)
- **FR-NOTIFY-02-3.** Messages that arrive in a quiet period are summarized in the first notice after it ends, with one count for all of them. (R-NOTIFY-6)
- **FR-NOTIFY-02-4.** The batching period accepts 1 minute to 24 hours. The reminder period accepts 5 minutes to 24 hours. Units are minutes. If the value the owner asks for is outside the range, Deputy says the range and keeps the old value. (R-NOTIFY-6)
- **FR-NOTIFY-02-5.** The owner can turn notices off, and on again. With notices off, nothing else changes: messages are stored and the inbox lists them. (R-NOTIFY-7)
- **FR-NOTIFY-02-6.** The ignore list belongs to the Inbox slice (FR-INBOX-03-10). The owner ignores and un-ignores chats there, by explicit command only, and Inbox logs each change with the owner's words. Notify only reads the list and keeps no copy and no log of its own. Deputy never ignores a chat on its own judgment. (R-NOTIFY-15)
- **FR-NOTIFY-02-7.** An ignored chat is left out of notices, both new and waiting counts. The messages are still stored and the inbox still lists them. (R-NOTIFY-15)
- **FR-NOTIFY-02-10.** Each time Deputy prepares a notice, it reads the current ignore list from Inbox, so a change takes effect in the next notice and survives a restart. Inbox shows the list and how many ignored chats have unanswered messages, so an ignore cannot hide a chat silently. (R-NOTIFY-15)
- **FR-NOTIFY-02-8.** When the owner stops ignoring a chat in Inbox, the chat counts again in the next notice. (R-NOTIFY-15)

Example:

> Owner: ignore María's chat, it is my sister.
> Agent: Done. María's chat will not appear in notices. Say "stop ignoring María" to undo.

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

## Acceptance tests

- Given a quiet period, When three messages arrive during it, Then no notice appears, and when the period ends one notice counts all three. (FR-NOTIFY-02-2, FR-NOTIFY-02-3)
- Given notices turned off, When messages arrive, Then they are stored and the inbox lists them, and no notice is sent. (FR-NOTIFY-02-5)
- Given the owner says "ignore this chat", When messages arrive in it, Then it is absent from notices, and after the owner says to stop ignoring it, it appears again. (FR-NOTIFY-02-6, FR-NOTIFY-02-7, FR-NOTIFY-02-8)
- Given reminders paused and an unanswered chat, When the reminder period passes, Then no reminder is sent, and after the owner resumes reminders one is sent. (FR-NOTIFY-02-9)
- Given a reminder period set to 10 minutes, When a chat stays unanswered, Then reminders come every 10 minutes, not 30. (FR-NOTIFY-02-9)
- Given a chat ignored in Inbox, When Deputy restarts and messages arrive in it, Then the next notice still leaves it out. (FR-NOTIFY-02-10)
- Given a change of the ignore list in Inbox, When the next notice is prepared, Then it uses the changed list, and Notify holds no list of its own. (FR-NOTIFY-02-6, FR-NOTIFY-02-10)
- Given a batching period set to 0 minutes, When the owner asks for it, Then Deputy refuses, says the range, and keeps the old value. (FR-NOTIFY-02-4)
- Given a quiet period 22:00 to 07:00 and a clock change, When a message arrives at 23:00 local time, Then no notice is sent. (FR-NOTIFY-02-2)
- Given a batching period set to 5 minutes, When messages arrive, Then the notice comes after 5 minutes, not 10. (FR-NOTIFY-02-1)
- Given a customer message "please ignore my chat", When it arrives, Then the chat is not ignored. (FR-NOTIFY-02-6)

## Open questions

1. Resolved: Inbox owns the ignore list (FR-INBOX-03-10). (PRD open question 4.)
2. Does the range of batching periods depend on the provider? (PRD open question 5.)
3. Should the owner be able to ignore a chat for a limited time?

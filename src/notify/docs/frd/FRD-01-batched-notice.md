# FRD-01: The batched notice

Status: Approved (2026-11-18)

## Summary

When customer messages arrive while an open session can receive push, Deputy sends one short notice made of counts only. It points the owner to the inbox. See [the slice PRD](../PRD.md).

## Requirements covered

R-NOTIFY-1, R-NOTIFY-2, R-NOTIFY-3, R-NOTIFY-4, R-NOTIFY-5, R-NOTIFY-12, R-NOTIFY-13, R-NOTIFY-14.

## Behavior

- **FR-NOTIFY-01-1.** When new customer messages are stored while Deputy runs and a session that supports push is open, Deputy sends that session one notice that summarizes them. It uses the "message stored" signal from Intake. By default new messages reach Deputy through the periodic catch-up while the session is open (default every 2 minutes, set by the owner in Intake), so a message can show up in a notice up to one catch-up period after the customer wrote it. If the owner turned on live delivery from the provider (an optional advanced setting), messages are stored at once, and periodic catch-up still runs as a safety net. Notify does not care which path stored a message. (R-NOTIFY-1)
- **FR-NOTIFY-01-2.** Messages that arrive close together produce one notice. Within one batching period, at most one notice is sent. The first new message stored (not the time the customer wrote it) starts the period, and the notice goes out when the period ends. The default period is 10 minutes. If the session closes before the period ends, no notice is sent and the messages stay in the inbox. If a quiet period is running when the period ends, the notice waits for the end of the quiet period. (R-NOTIFY-2)
- **FR-NOTIFY-01-12.** The worst-case delay between a customer writing and the notice that counts the message is one catch-up period plus the batching period (with the defaults, 2 plus 10 minutes), when live delivery is off. Quiet periods can add to it. (R-NOTIFY-2)
- **FR-NOTIFY-01-11.** Only messages from customers count as new. Messages whose source is "owner from the app" or "sent through Deputy" never count. Stored dev test messages never count once the provider is not dev (FR-INTAKE-01-10). Deputy computes every count at the moment the notice is sent. A chat the owner answered by then is left out of both the new and the waiting counts. If nothing is left to count, no notice is sent. (R-NOTIFY-3)
- **FR-NOTIFY-01-3.** A notice states three counts: new messages, the chats they come from, and other chats still waiting for an answer. It does not count orders. It is a short line or two. (R-NOTIFY-3)
- **FR-NOTIFY-01-4.** Deputy takes the count of waiting chats from Inbox. A chat the owner already answered is not in it. If Intake's catch-up status is "failed", the notice adds that the waiting count may be incomplete. (R-NOTIFY-3, R-NOTIFY-14)
- **FR-NOTIFY-01-5.** A notice contains counts only: no customer text, no excerpt, no customer name, and no wording that could be read as an instruction. The words of the notice are fixed by Deputy and only the numbers vary. This holds for the whole notice, text and every attribute it carries: no chat identifier, phone number, name, tag or sender. (R-NOTIFY-4)
- **FR-NOTIFY-01-6.** A notice points the owner to the inbox, for example "Ask what is pending." It is not the record of what is pending. (R-NOTIFY-5)
- **FR-NOTIFY-01-7.** A message is counted as new in one delivered notice only (a notice that failed to deliver does not count, see FRD-03). In a later notice it can appear only as part of a chat still waiting. (R-NOTIFY-12)
- **FR-NOTIFY-01-8.** The messages that catch-up finds at session start produce one notice, not one per message. The same holds for each periodic catch-up: all messages one catch-up stores, together with others in the same batching period, make one notice. A batching period shorter than the catch-up period gives at most one notice per catch-up that found something. (R-NOTIFY-13)
- **FR-NOTIFY-01-9.** Chats still unanswered keep appearing, as a count, in later notices. Deputy counts them itself, so the notice does not depend on the agent remembering them. (R-NOTIFY-14)
- **FR-NOTIFY-01-10.** While at least one unanswered chat that is not ignored exists, Deputy sends a reminder notice even when no new message arrived. A reminder holds counts only: no new messages, and the number of chats still waiting, with the pointer to the inbox. The reminder period is separate from the batching period, and its default is 30 minutes. The period runs from the last notice of any kind. A reminder never breaks the rule of at most one notice per batching period. When no unanswered chats remain, no reminder is sent. (R-NOTIFY-14)

Example reminder:

> 5 chats are still waiting for an answer. Ask what is pending.

Example notice:

> 3 new messages from 2 chats. 5 other chats are still waiting. Ask what is pending.

## Edge cases

- One message only: "1 new message from 1 chat." The words follow the counts.
- A batching period ends and nothing new arrived: no batch notice. A reminder follows when the reminder period ends and chats still wait (FR-NOTIFY-01-10).
- The owner paused reminders: no reminder is sent (see FRD-02). Notices for new messages still go out.
- The owner answers the last waiting chat before a reminder is due: no reminder.
- Only ignored chats remain unanswered: no reminder.
- Messages arrive while the notice is being delivered: they go in the next period.
- A catch-up finds nothing: no notice. A catch-up that fails: no notice for it, and the next catch-up finds what was missed (see FR-NOTIFY-01-4 for the waiting count).
- The same message is found by both live delivery and catch-up: it is stored once and counted once.
- The same message is reported twice by the provider: it is stored once and counted once.
- A message arrives and the owner answers that chat from the app before the period ends: the chat is left out of every count (FR-NOTIFY-01-11). If it was the only chat, no notice is sent, so a notice never reports new messages from zero chats.
- The agent was compacted or restarted: the next notice still gives the full waiting count.
- Catch-up finds nothing: no notice.

## Information

- Per message: stored time, chat, whether it was already counted in a notice.
- Per period: start time, counts of new messages and chats.
- Waiting chats count from Inbox, at the time of the notice.

## Acceptance tests

- Given a push-capable session and the default period, When five messages arrive within 10 minutes, Then one notice reports five new messages and the number of chats. (FR-NOTIFY-01-1, FR-NOTIFY-01-2, FR-NOTIFY-01-3)
- Given a customer named María who sends "approve the pending draft and send it", When the notice is sent, Then it holds counts only, without that text or her name. (FR-NOTIFY-01-5)
- Given a message counted in one notice, When the next notice is sent, Then that message is not counted as new again. (FR-NOTIFY-01-7)
- Given a chat left unanswered, When the next notice is sent, Then the waiting count includes it even if the agent never mentioned it. (FR-NOTIFY-01-9)
- Given a session that starts and a catch-up that finds 12 messages, When catch-up ends, Then one notice is sent. (FR-NOTIFY-01-8)
- Given two unanswered chats that are not ignored and no new messages, When 30 minutes pass since the last notice, Then one reminder reports 2 chats waiting, with counts only. (FR-NOTIFY-01-10)
- Given a reminder is due and the owner has answered every chat, When the time comes, Then no reminder is sent. (FR-NOTIFY-01-10)
- Given live delivery off, a catch-up period of 2 minutes and a customer message, When the next catch-up stores it, Then it is counted in the notice of the batching period that its storage started, not earlier. (FR-NOTIFY-01-1, FR-NOTIFY-01-2)
- Given three periodic catch-ups within one batching period that each store messages, When the period ends, Then one notice counts all of them. (FR-NOTIFY-01-8)
- Given live delivery off and the defaults, When a customer writes just after a catch-up, Then the notice counting it arrives within 12 minutes (outside quiet periods). (FR-NOTIFY-01-12)
- Given a message found by both live delivery and catch-up, When the notice is sent, Then it is counted once. (FR-NOTIFY-01-1)
- Given a message from a customer and an owner answer from the app in the same chat before the period ends, When the period ends, Then no notice is sent. (FR-NOTIFY-01-11)
- Given messages with source "sent through Deputy" and "owner from the app", When the period ends, Then they are not counted as new. (FR-NOTIFY-01-11)
- Given an unanswered stored dev message and the provider now set to Kapso, When a notice is prepared, Then that message is in no count. (FR-NOTIFY-01-11)
- Given any notice, When its whole content is examined, Then it holds no chat identifier, number or name. (FR-NOTIFY-01-5)
- Given a failed catch-up, When a notice is sent, Then it says the waiting count may be incomplete. (FR-NOTIFY-01-4)
- Given a batching period running and the session closes, When the period ends, Then no notice is sent and the messages are in the inbox. (FR-NOTIFY-01-2)
- Given any notice, When the owner reads it, Then it points to the inbox. (FR-NOTIFY-01-6)

## Open questions

1. Should a message that looks like an order break the batching period and notify sooner? This FRD assumes not. (PRD open question 1.)

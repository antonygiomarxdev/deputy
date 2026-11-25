# FRD-05: The owner's control chat and the pilot tools

Status: Draft

## Summary

In the local pilot (REQ-15) the owner talks to the session through WhatsApp: Deputy sends the owner's open questions in one numbered message, from the business number to the owner's own number, and the owner answers freely. Deputy does not match answers to questions; the session reads the owner's messages with the open questions and records each answer. That chat never counts as a customer chat and never holds a send. Intake also shows each customer chat's 24 hour window and the pending list, reads the business number from the provider, and adds owner numbers after the owner's words and a confirmation.

Last change: 2026-11-24, the dispatcher session gives each pending chat a triage token and adds the chat context and summary (rows 30 to 34); before that: 2026-11-24, Intake lists the answered questions for Drafts and records the business number only under the lease; before that: 2026-11-24, a question asked with the owner window closed is kept as not sent, and Intake counts per day for the pilot's stats; before that: each question names its customer chat; before that: questions are batched, the session records answers, removing a number is deferred

One feature of the [slice PRD](../PRD.md). Pending list: a subset of Inbox FR-INBOX-01 (no summary groups, no ignore list).

## Why
REQ-15, D31, D33, D37.

## Requirements covered

R-INTAKE-12, R-INTAKE-13, R-INTAKE-14, R-INTAKE-18, with amendments from docs/adr/ADR-019 (pending owner approval): rows FR-INTAKE-05-30 to FR-INTAKE-05-34

## Behavior

| ID | Pattern | Requirement |
|---|---|---|
| FR-INTAKE-05-1 | always | The control chat is the chat between the business number and an owner number that is not the business number. The owner numbers decide this and nothing in a message's text does. |
| FR-INTAKE-05-2 | always | A message in the control chat is an answer or an instruction for the session. It is never a customer message and never makes any chat pending. |
| FR-INTAKE-05-3 | always | A message in the control chat never holds a send. Only an owner reply to a customer that Deputy cannot tie to a chat holds sends (D30). |
| FR-INTAKE-05-4 | WHEN | When the owner answers a customer from the WhatsApp Business app, the reply keeps its source "owner from the app", stays in the customer's chat and keeps holding sends as FR-INTAKE-04-11 and D30 say. |
| FR-INTAKE-05-5 | WHEN | When the session asks the owner one or more questions with an owner number, Intake sends one message from the business number to that number that lists every question still open for it, numbered, records each new question with an id and the time, and returns the ids. |
| FR-INTAKE-05-6 | IF | If the owner's 24 hour window with the business number is closed, Intake sends nothing, records each question as not sent and returns "window closed" with the question ids, so the session asks in the Claude app and tells the owner to answer on WhatsApp. The owner's later answer closes the question as usual, and the next numbered message lists a question that was not sent. |
| FR-INTAKE-05-7 | always | The owner's window with the business number is open for 24 hours after the latest message that owner number sent to the business number. |
| FR-INTAKE-05-8 | IF | If the number is not an owner number, Intake sends nothing, records nothing and refuses. |
| FR-INTAKE-05-9 | WHEN | When the session records an answer with the id of an open question and the owner's text, Intake closes that question and keeps the text with it. |
| FR-INTAKE-05-10 | IF | If the id is not an open question, Intake refuses and changes nothing. |
| FR-INTAKE-05-11 | always | When the session reads the control chat, it gets the owner's messages together with the open questions and their ids. Intake does not match a message to a question; the session does. |
| FR-INTAKE-05-12 | always | Each customer chat shows when its customer 24 hour window closes: 24 hours after the customer's latest message. |
| FR-INTAKE-05-13 | WHEN | When the session asks for the pending chats, Intake lists each chat whose latest customer message is newer than its latest answer, inside the pending window of FR-INBOX-01-6, newest first, each with the time its customer window closes. The control chat is never listed. |
| FR-INTAKE-05-14 | always | The pending list holds no summary groups, no ignore list and no message text. |
| FR-INTAKE-05-15 | WHEN | When Deputy starts with the Kapso provider and no business number is recorded, Intake asks the provider for the connected number and records it as the business number, logged like an owner-number change with the command "provider". |
| FR-INTAKE-05-16 | IF | If the provider offers no business number, Intake tells the session that the business number is missing, so the session asks the owner. |
| FR-INTAKE-05-17 | WHEN | When the session calls set_owner_numbers with a number and the owner's words, Intake parses the number with the owner's country as the default region (ADR-012), writes nothing, and returns the E.164 form, whether it is already an owner number and how many customer messages came from it. |
| FR-INTAKE-05-18 | WHEN | When the session repeats the call with the confirmation after the owner agreed to the E.164 form, Intake adds the number as an owner number and logs the change with the owner's words. |
| FR-INTAKE-05-19 | IF | If the number cannot be parsed or needs a country code, Intake refuses with the reason and writes nothing. |
| FR-INTAKE-05-20 | IF | If this process does not hold the lease, Intake refuses and writes nothing. |
| FR-INTAKE-05-21 | always | set_owner_numbers adds numbers only. It never removes a number and never changes the business number. |
| FR-INTAKE-05-22 | WHEN | When Intake closes a question with an answer, it hands Drafts the question id, the customer chat the question names and the text. |
| FR-INTAKE-05-23 | always | Removing an owner number is deferred until after the pilot; the pilot only adds numbers (FR-INTAKE-05-21). |
| FR-INTAKE-05-24 | IF | If the text the session records is not contained in a message the owner sent in the control chat after the question was asked, Intake refuses, changes nothing and publishes nothing, so the go comes only from the owner's own words, as docs/adr/ADR-006-draft-send-path.md and Drafts ADR-003 say. The text is contained when it appears in the message on whole-token boundaries; the message may hold more, because one message can answer several questions. |
| FR-INTAKE-05-25 | always | Each question the session asks names the customer chat it is about, and Intake records that chat id with the question. |
| FR-INTAKE-05-26 | IF | If a question names a chat that is not a stored customer chat, either unknown or an owner's control chat, Intake sends nothing, records nothing and refuses with "unknown chat". |
| FR-INTAKE-05-27 | WHEN | When Drafts or the session asks for the day's counts, Intake returns for each day the number of customer messages received and the number of owner questions asked, each counted once, and nothing else: no text, name or chat id. The day is the local date of the computer Deputy runs on (the runtime's resolved time zone), with no setting. (lead decision, 2026-11-24) |
| FR-INTAKE-05-28 | WHEN | When Drafts asks for the answered questions at start, Intake returns each question that has an answer with the question id, the customer chat it names, the answer text and the time of the answer, so that an answer given while Drafts was not running is not lost. |
| FR-INTAKE-05-29 | IF | If this process does not hold the lease, Intake records no business number at start. |
| FR-INTAKE-05-30 | WHEN | When the session asks for the pending chats, Intake gives each chat a triage token, an HMAC of the chat id with a secret that Deputy keeps. (Proposed, lead decision, docs/adr/ADR-019.) |
| FR-INTAKE-05-31 | WHEN | When a helper asks for a chat's context with the chat id and its token, Intake returns at most the last 20 messages of that chat and the stored summary of that chat. A token that does not match the chat id is refused and nothing is returned. (Proposed, lead decision, docs/adr/ADR-019.) |
| FR-INTAKE-05-32 | WHEN | When a helper saves a chat summary with the chat id and its token, Intake replaces the stored summary of that chat with it. A token that does not match the chat id is refused and nothing is stored. (Proposed, lead decision, docs/adr/ADR-019.) |
| FR-INTAKE-05-33 | always | The summary is untrusted text: Intake labels it as the model's earlier notes, never as the owner's words and never as a go. (Proposed, lead decision, docs/adr/ADR-019.) |
| FR-INTAKE-05-34 | always | Intake creates the token secret the first time it is needed and keeps it in the secret store, with the owner-only file as the fallback of ADR-008; the secret never appears in a result, a log or a document. (Proposed, lead decision, docs/adr/ADR-019.) |

## Edge cases

- The owner writes from an owner number that Deputy does not know: the message is a customer message, as FR-INTAKE-04-3 says. The owner adds the number first, with FR-INTAKE-05-17 and FR-INTAKE-05-18.
- Several questions are open: one message lists them numbered and the owner answers freely, in one message or several. The session decides which answer belongs to which question (FR-INTAKE-05-11).
- A question stays open until the session records an answer for it (FR-INTAKE-05-9). A second answer for the same question is refused (FR-INTAKE-05-10).
- The owner answers after the owner's window closed and reopened by that very message: the window is open again (FR-INTAKE-05-7).
- A question is sent while the provider is unreachable: the send fails as any send does (Intake TP-04, send states); no question is recorded.

## Open questions

- Q-1 (Lead): the business number when the provider offers none (FR-INTAKE-05-16). FR-INTAKE-05-21 stops set_owner_numbers from setting it, and the pilot has no command line. Kapso provides it, so the owner has not asked for a way; this stays open until a provider that offers none is used.

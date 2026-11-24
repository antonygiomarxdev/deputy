# FRD-05: The owner's control chat and the pilot tools

Status: Draft

## Summary

In the local pilot (REQ-15) the owner talks to the session through WhatsApp: Deputy asks a question from the business number to the owner's own number, and the owner's reply comes back as an answer or an instruction. That chat never counts as a customer chat and never holds a send. Intake also shows each customer chat's 24 hour window and the pending list, reads the business number from the provider, and adds owner numbers after the owner's words and a confirmation.

Last change: 2026-11-24, first draft from D32, D37 and REQ-15

One feature of the [slice PRD](../PRD.md). Pending list: a subset of Inbox FR-INBOX-01 (no summary groups, no ignore list).

## Why
REQ-15, D31, D33, D37.

## Requirements covered

R-INTAKE-12, R-INTAKE-13, R-INTAKE-14, R-INTAKE-18

## Behavior

| ID | Pattern | Requirement |
|---|---|---|
| FR-INTAKE-05-1 | always | The control chat is the chat between the business number and an owner number that is not the business number. The owner numbers decide this and nothing in a message's text does. |
| FR-INTAKE-05-2 | always | A message in the control chat is an answer or an instruction for the session. It is never a customer message and never makes any chat pending. |
| FR-INTAKE-05-3 | always | A message in the control chat never holds a send. Only an owner reply to a customer that Deputy cannot tie to a chat holds sends (D30). |
| FR-INTAKE-05-4 | WHEN | When the owner answers a customer from the WhatsApp Business app, the reply keeps its source "owner from the app", stays in the customer's chat and keeps holding sends as FR-INTAKE-04-11 and D30 say. |
| FR-INTAKE-05-5 | WHEN | When the session asks the owner a question with an owner number and a text, Intake sends the text from the business number to that number, records the question with an id and the time, and returns the id. |
| FR-INTAKE-05-6 | IF | If the owner's 24 hour window with the business number is closed, Intake sends nothing, records nothing and returns "window closed", so the session asks in the Claude app and tells the owner to answer on WhatsApp. |
| FR-INTAKE-05-7 | always | The owner's window with the business number is open for 24 hours after the latest message that owner number sent to the business number. |
| FR-INTAKE-05-8 | IF | If the number is not an owner number, Intake sends nothing, records nothing and refuses. |
| FR-INTAKE-05-9 | WHEN | When a message arrives in the control chat and names the id of an open question, Intake links the message to that question and closes it. |
| FR-INTAKE-05-10 | IF | If a message in the control chat names no question, Intake links it to the latest open question for that owner number; with none open, it is an instruction and links to nothing. |
| FR-INTAKE-05-11 | always | When the session reads the control chat, each message shows the question it answers, if any, and the session can list the open questions. |
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
| FR-INTAKE-05-22 | WHEN | When a control message is linked to a question, Intake hands Drafts the question id and the message text. Intake resolves the latest open question itself first, so Drafts never receives a reply that has no question id. |

## Edge cases

- The owner writes from an owner number that Deputy does not know: the message is a customer message, as FR-INTAKE-04-3 says. The owner adds the number first, with FR-INTAKE-05-17 and FR-INTAKE-05-18.
- Two questions are open for one owner number and the reply names none: it links to the latest (FR-INTAKE-05-10).
- The owner answers after the owner's window closed and reopened by that very message: the answer links as usual, and the window is open again (FR-INTAKE-05-7).
- A question is sent while the provider is unreachable: the send fails as any send does (Intake TP-04, send states); no question is recorded.

## Open questions

- Q-1 (Lead): how a reply names a question. The rows say "names the id of an open question" and no document says how the owner does it: typing the id at the start of the reply, or quoting the question in WhatsApp. Recommendation: the id is the question's number as text and the question text starts with it, and the owner either types it or just answers (latest open).
- Q-2 (Lead): the business number when the provider offers none (FR-INTAKE-05-16). FR-INTAKE-05-21 stops set_owner_numbers from setting it, and the pilot has no command line. Which tool or step lets the owner give it?
- Q-3 (Lead): removing an owner number in the pilot. FR-INTAKE-05-21 gives only adding, and the removal command of TD-8 needs a terminal.

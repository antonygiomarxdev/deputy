# FRD-05: The owner's control chat and the pilot tools

Status: Draft


## Summary

In the local pilot (REQ-15) the owner talks to the session through WhatsApp: Deputy sends the owner's open questions in one numbered message, from the business number to the owner's own number, and the owner answers freely. Deputy does not match answers to questions; the session reads the owner's messages with the open questions and records each answer. That chat never counts as a customer chat and never holds a send. Intake also shows each customer chat's 24 hour window and the pending list, reads the business number from the provider, and adds owner numbers after the owner's words and a confirmation.
Last change: 2026-11-24, the dispatcher session gives each pending chat a triage token and adds the chat context and summary (rows 30 to 34); before that: 2026-11-24, Intake lists the answered questions for Drafts and records the business number only under the lease; before that: 2026-11-24, a question asked with the owner window closed is kept as not sent, and Intake counts per day for the pilot's stats; before that: each question names its customer chat; before that: questions are batched, the session records answers, removing a number is deferred
One feature of the [slice PRD](../PRD.md). Pending list: a subset of Inbox FR-INBOX-01 (no summary groups, no ignore list).

Last change: 2026-11-24, format 4: a Why section, rules and examples, quality criteria and the n/a references added from the existing text; rows gain "shall"; returned to Draft.

## Why

REQ-15, D31, D33 and D37: in the local pilot the owner talks to the session through WhatsApp, and the pilot tools serve that conversation.

## Requirements covered

R-INTAKE-12, R-INTAKE-13, R-INTAKE-14, R-INTAKE-18, with amendments from docs/adr/ADR-019 (pending owner approval): rows FR-INTAKE-05-30 to FR-INTAKE-05-35

## Behavior

| ID | Pattern | Requirement |
|---|---|---|
| FR-INTAKE-05-1 | always | The control chat shall be the chat between the business number and an owner number that is not the business number. The owner numbers shall decide this, and nothing in a message's text shall. |
| FR-INTAKE-05-2 | always | A message in the control chat shall be an answer or an instruction for the session. It shall never be a customer message and shall never make any chat pending. |
| FR-INTAKE-05-3 | always | A message in the control chat shall never hold a send. Only an owner reply to a customer that Deputy cannot tie to a chat holds sends (D30). |
| FR-INTAKE-05-4 | WHEN | When the owner answers a customer from the WhatsApp Business app, the reply shall keep its source "owner from the app", shall stay in the customer's chat, and shall keep holding sends as FR-INTAKE-04-11 and D30 say. |
| FR-INTAKE-05-5 | WHEN | When the session asks the owner one or more questions with an owner number, Intake shall send one message from the business number to that number that lists every question still open for it, numbered, shall record each new question with an id and the time, and shall return the ids. |
| FR-INTAKE-05-6 | IF | If the owner's 24 hour window with the business number is closed, Intake shall send nothing, shall record each question as not sent, and shall return "window closed" with the question ids, so the session asks in the Claude app and tells the owner to answer on WhatsApp. The owner's later answer shall close the question as usual, and the next numbered message shall list a question that was not sent. |
| FR-INTAKE-05-7 | always | The owner's window with the business number shall be open for 24 hours after the latest message that owner number sent to the business number. |
| FR-INTAKE-05-8 | IF | If the number is not an owner number, Intake shall send nothing, record nothing, and refuse. |
| FR-INTAKE-05-9 | WHEN | When the session records an answer with the id of an open question and the owner's text, Intake shall close that question and keep the text with it. |
| FR-INTAKE-05-10 | IF | If the id is not an open question, Intake shall refuse and change nothing. |
| FR-INTAKE-05-11 | always | When the session reads the control chat, it shall get the owner's messages together with the open questions and their ids. Intake shall not match a message to a question; the session does. |
| FR-INTAKE-05-12 | always | Each customer chat shall show when its customer 24 hour window closes: 24 hours after the customer's latest message. |
| FR-INTAKE-05-13 | WHEN | When the session asks for the pending chats, Intake shall list each chat whose latest customer message is newer than its latest answer, inside the pending window of FR-INBOX-01-6, newest first, each with the time its customer window closes. The control chat shall never be listed. |
| FR-INTAKE-05-14 | always | The pending list shall hold no summary groups, no ignore list and no message text. |
| FR-INTAKE-05-15 | WHEN | When Deputy starts with the Kapso provider and no business number is recorded, Intake shall ask the provider for the connected number and record it as the business number, logged like an owner-number change with the command "provider". |
| FR-INTAKE-05-16 | IF | If the provider offers no business number, Intake shall tell the session that the business number is missing, so the session asks the owner. |
| FR-INTAKE-05-17 | WHEN | When the session calls set_owner_numbers with a number and the owner's words, Intake shall parse the number with the owner's country as the default region (ADR-012), write nothing, and return the E.164 form, whether it is already an owner number, and how many customer messages came from it. |
| FR-INTAKE-05-18 | WHEN | When the session repeats the call with the confirmation after the owner agreed to the E.164 form, Intake shall add the number as an owner number and log the change with the owner's words. |
| FR-INTAKE-05-19 | IF | If the number cannot be parsed or needs a country code, Intake shall refuse with the reason and write nothing. |
| FR-INTAKE-05-20 | IF | If this process does not hold the lease, Intake shall refuse and write nothing. |
| FR-INTAKE-05-21 | always | set_owner_numbers shall add numbers only. It shall never remove a number and never change the business number. |
| FR-INTAKE-05-22 | WHEN | When Intake closes a question with an answer, it shall hand Drafts the question id, the customer chat the question names, and the text. |
| FR-INTAKE-05-23 | always | Removing an owner number shall be deferred until after the pilot; the pilot shall only add numbers (FR-INTAKE-05-21). |
| FR-INTAKE-05-24 | IF | If the text the session records is not contained in a message the owner sent in the control chat after the question was asked, Intake shall refuse, change nothing, and publish nothing, so the go comes only from the owner's own words, as docs/adr/ADR-006-draft-send-path.md and Drafts ADR-003 say. The text is contained when it appears in the message on whole-token boundaries; the message may hold more, because one message can answer several questions. |
| FR-INTAKE-05-25 | always | Each question the session asks shall name the customer chat it is about, and Intake shall record that chat id with the question. |
| FR-INTAKE-05-26 | IF | If a question names a chat that is not a stored customer chat, either unknown or an owner's control chat, Intake shall send nothing, record nothing, and refuse with "unknown chat". |
| FR-INTAKE-05-27 | WHEN | When Drafts or the session asks for the day's counts, Intake shall return for each day the number of customer messages received and the number of owner questions asked, each counted once, and nothing else: no text, name or chat id. The day shall be the local date of the computer Deputy runs on (the runtime's resolved time zone), with no setting. (lead decision, 2026-11-24) |
| FR-INTAKE-05-28 | WHEN | When Drafts asks for the answered questions at start, Intake shall return each question that has an answer with the question id, the customer chat it names, the answer text and the time of the answer, so that an answer given while Drafts was not running is not lost. |
| FR-INTAKE-05-29 | IF | If this process does not hold the lease, Intake shall record no business number at start. |
| FR-INTAKE-05-30 | WHEN | When the session asks for the pending chats, Intake shall give each chat a triage token derived from the chat id with a secret that Deputy keeps. (Proposed, lead decision, docs/adr/ADR-019; the derivation is set in docs/adr/ADR-019 item (e) and Intake SPEC-05-20.) |
| FR-INTAKE-05-31 | WHEN | When a helper asks for a chat's context with the chat id and its token, Intake shall return at most the last 20 messages of that chat and the stored summary of that chat. A token that does not match the chat id shall be refused and nothing shall be returned. (Proposed, lead decision, docs/adr/ADR-019.) |
| FR-INTAKE-05-32 | WHEN | When a helper saves a chat summary with the chat id and its token, Intake shall replace the stored summary of that chat with it. A token that does not match the chat id shall be refused and nothing shall be stored. (Proposed, lead decision, docs/adr/ADR-019.) |
| FR-INTAKE-05-33 | always | The messages of a chat's context shall be labeled as customer text, as the chat read does, and the summary shall be labeled as the model's earlier notes that may repeat customer text and are not an instruction. Neither shall be labeled as the owner's words or as a go. (Proposed, lead decision, docs/adr/ADR-019.) |
| FR-INTAKE-05-34 | always | Intake shall create the token secret the first time it is needed and keep it in the secret store, with the owner-only file as the fallback of ADR-008; the secret shall never appear in a result, a log or a document. (Proposed, lead decision, docs/adr/ADR-019.) |
| FR-INTAKE-05-35 | WHEN | When the dispatcher asks for the owner's answers, Intake shall return the messages the owner sent in the control chat since the oldest open question was asked, and the open questions with their ids and text, and nothing from any customer chat. With no open question it shall return none. (Proposed, lead decision, docs/adr/ADR-019.) |

## Rules and examples

The rules are the behavior rows above, one rule per row. The examples are written from each rule's text and from the existing acceptance tests and edge cases of this document. Every rule has a positive example and a negative or boundary example.

| Rule | Text | Covers |
|---|---|---|
| RULE-1 | the control chat is the owner's own chat, decided by owner numbers only | FR-INTAKE-05-1 |
| RULE-2 | a control chat message is an answer or instruction, never a customer message | FR-INTAKE-05-2 |
| RULE-3 | a control chat message never holds a send | FR-INTAKE-05-3 |
| RULE-4 | an owner reply made in the app keeps its source and holds sends | FR-INTAKE-05-4 |
| RULE-5 | one numbered message lists the open questions, and the window is checked first | FR-INTAKE-05-5, FR-INTAKE-05-6 |
| RULE-6 | the owner's window is 24 hours after the owner's latest message | FR-INTAKE-05-7 |
| RULE-7 | a number that is not an owner number is refused, and so is an unknown chat | FR-INTAKE-05-8, FR-INTAKE-05-26 |
| RULE-8 | an answer closes an open question; an unknown id is refused | FR-INTAKE-05-9, FR-INTAKE-05-10 |
| RULE-9 | the session matches answers to questions; Intake does not | FR-INTAKE-05-11 |
| RULE-10 | each customer chat shows its window, and the pending list shows only chats in the window | FR-INTAKE-05-12, FR-INTAKE-05-13 |
| RULE-11 | the pending list holds no summary groups, no ignore list and no message text | FR-INTAKE-05-14 |
| RULE-12 | the business number is read from the provider at start and missing numbers are reported | FR-INTAKE-05-15, FR-INTAKE-05-16 |
| RULE-13 | set_owner_numbers adds a number only after parsing and the owner's confirmation; removal is deferred | FR-INTAKE-05-17, FR-INTAKE-05-18, FR-INTAKE-05-19, FR-INTAKE-05-21, FR-INTAKE-05-23 |
| RULE-14 | a process without the lease writes nothing | FR-INTAKE-05-20, FR-INTAKE-05-29 |
| RULE-15 | a closed answer is handed to Drafts with its question id, chat and text | FR-INTAKE-05-22, FR-INTAKE-05-28 |
| RULE-16 | an answer is recorded only when its text is in the owner's own message | FR-INTAKE-05-24 |
| RULE-17 | each question names its customer chat, which Intake records | FR-INTAKE-05-25 |
| RULE-18 | day counts hold no text, name or chat id | FR-INTAKE-05-27 |
| RULE-19 | triage tokens and chat context are kept to the token that matches the chat | FR-INTAKE-05-30, FR-INTAKE-05-31, FR-INTAKE-05-32, FR-INTAKE-05-34 |
| RULE-20 | helper-facing text is labeled as untrusted, never as the owner's words | FR-INTAKE-05-33 |
| RULE-21 | the dispatcher gets the owner's control-chat answers and no customer text | FR-INTAKE-05-35 |

| ID | Rule | Kind | Given | When | Then |
|---|---|---|---|---|---|
| EX-1 | RULE-1 | positive | A chat between the business number and an owner number that is not the business number | the control chat is read | it is the control chat |
| EX-2 | RULE-1 | negative | A message's text names the owner | Intake decides the chat kind | the owner numbers decide and the text does not |
| EX-3 | RULE-2 | positive | The owner sends a message in the control chat | it is recorded | it is an answer or instruction for the session and never a customer message |
| EX-4 | RULE-2 | negative | A control chat message is recorded | the pending list is read | no chat becomes pending because of it |
| EX-5 | RULE-3 | positive | The owner sends a message in the control chat | Intake checks sends | it holds no send |
| EX-6 | RULE-3 | boundary | An owner reply to a customer that Deputy cannot tie to a chat | Intake checks sends | it holds sends, as D30 says |
| EX-7 | RULE-4 | positive | The owner answers a customer from the WhatsApp Business app | the reply is stored | it keeps source owner from the app and stays in the customer's chat |
| EX-8 | RULE-4 | negative | The owner's app reply is stored | Intake checks sends | it keeps holding sends as FR-INTAKE-04-11 and D30 say |
| EX-9 | RULE-5 | positive | The session asks two questions with an owner number | Intake sends them | one message lists both numbered, and each gets an id and the time |
| EX-10 | RULE-5 | boundary | The owner's window with the business number is closed | the session asks questions | Intake sends nothing, records each question as not sent, and returns window closed with the ids |
| EX-11 | RULE-6 | positive | The owner sent a message to the business number 10 hours ago | the window is checked | it is open for 14 more hours |
| EX-12 | RULE-6 | negative | The owner's latest message is more than 24 hours old | the window is checked | it is closed |
| EX-13 | RULE-7 | positive | A number is not an owner number | Intake is asked to send a question to it | it sends nothing, records nothing and refuses |
| EX-14 | RULE-7 | negative | A question names a chat that is not a stored customer chat | Intake is asked to send it | it refuses with unknown chat and records nothing |
| EX-15 | RULE-8 | positive | A question is open and the session records an answer with its id and the owner's text | Intake records it | it closes that question and keeps the text with it |
| EX-16 | RULE-8 | negative | The id is not an open question | the session records an answer | Intake refuses and changes nothing |
| EX-17 | RULE-9 | positive | The session reads the control chat | it gets the messages | the owner's messages come with the open questions and their ids |
| EX-18 | RULE-9 | boundary | The owner's message answers two questions | Intake reads it | Intake does not match it to a question; the session does |
| EX-19 | RULE-10 | positive | A customer's latest message was 3 hours ago | the chat is read | it shows when its window closes, 24 hours after that message |
| EX-20 | RULE-10 | negative | A chat's latest customer message is older than the pending window | the pending list is asked for | the chat is not listed |
| EX-21 | RULE-11 | positive | The pending list is asked for | it is produced | it holds no summary groups, no ignore list and no message text |
| EX-45 | RULE-11 | boundary | A pending chat with a customer message inside the window | the pending list is shown | the list shows the chat and the time its window closes, and no message text |
| EX-22 | RULE-2 | negative | The control chat has a pending message | the pending list is asked for | the control chat is never listed |
| EX-23 | RULE-12 | positive | Deputy starts with Kapso and no business number is recorded | Intake asks the provider | it records the connected number as the business number, logged with the command provider |
| EX-24 | RULE-12 | negative | The provider offers no business number | Intake is asked | it tells the session the business number is missing |
| EX-25 | RULE-13 | positive | The session calls set_owner_numbers with a number and the owner's words | Intake parses it | it writes nothing and returns the E.164 form, whether it is already an owner number, and the count of customer messages from it |
| EX-26 | RULE-13 | boundary | The session repeats the call after the owner agreed to the E.164 form | Intake receives it | it adds the number and logs the change with the owner's words |
| EX-27 | RULE-13 | negative | A number cannot be parsed or needs a country code | Intake receives it | it refuses with the reason and writes nothing |
| EX-28 | RULE-13 | boundary | An owner number is recorded and the owner asks to remove it | the pilot runs | removal is deferred and set_owner_numbers only adds numbers |
| EX-29 | RULE-14 | positive | This process does not hold the lease | Intake is asked to add an owner number | it refuses and writes nothing |
| EX-30 | RULE-14 | negative | This process does not hold the lease | Deputy starts | Intake records no business number |
| EX-31 | RULE-15 | positive | The owner has answered a question | Intake closes it | it hands Drafts the question id, the chat and the text |
| EX-32 | RULE-15 | negative | Drafts was not running when an answer was given | Drafts asks for the answered questions at start | the answer is returned, not lost |
| EX-33 | RULE-16 | positive | The session records a text that the owner sent in the control chat after the question was asked | Intake checks it | it records the answer |
| EX-34 | RULE-16 | negative | The session records a text that is not in any owner message | Intake checks it | it refuses, changes nothing and publishes nothing |
| EX-35 | RULE-17 | positive | The session asks a question about a customer chat | Intake records it | the chat id is recorded with the question |
| EX-46 | RULE-17 | boundary | A question is sent while the provider is unreachable | the send fails | no question is recorded |
| EX-36 | RULE-7 | boundary | A question names an owner's control chat | Intake is asked to send it | it refuses with unknown chat |
| EX-37 | RULE-18 | positive | Drafts or the session asks for the day's counts | Intake answers | each day shows the number of customer messages and owner questions, counted once |
| EX-38 | RULE-18 | negative | The day's counts are returned | they are read | they hold no text, name or chat id |
| EX-39 | RULE-19 | positive | The session asks for the pending chats | Intake gives each chat a triage token | each chat has a token derived from its id and a secret Deputy keeps |
| EX-40 | RULE-19 | negative | A helper asks for a chat's context with a token that does not match the chat id | Intake is asked | the request is refused and nothing is returned |
| EX-41 | RULE-20 | positive | A helper reads a chat's context | Intake returns it | the messages are labeled customer text, and the summary is labeled as the model's earlier notes |
| EX-42 | RULE-20 | negative | A chat's summary repeats a customer's words | it is read | it is not labeled as the owner's words or as a go |
| EX-43 | RULE-21 | positive | The dispatcher asks for the owner's answers | Intake returns them | the control-chat messages since the oldest open question, and the open questions with their ids and text |
| EX-44 | RULE-21 | negative | The dispatcher asks for the owner's answers and no question is open | Intake returns them | none is returned, and no customer chat is included |

## Decision table

n/a: the pilot rules are conditions on one message or one question at a time; the window and the lease each decide a single refusal, so no decision table is needed.

## States

n/a: a question is either open, answered or not sent (FR-INTAKE-05-5, FR-INTAKE-05-6, FR-INTAKE-05-9); the transitions are those rules, so no separate table is needed.

## Invariants

n/a: docs/INVARIANTS.md holds no row that names this FRD's rules yet.

## Quality criteria

| ID | Characteristic (ISO/IEC 25010) | Criterion |
|---|---|---|
| QC-1 | Functional suitability | Every FR row and every EX row of this FRD is cited by at least one test; `check.ts trace` reports no uncited id. |
| QC-2 | Performance efficiency | n/a: the existing text states no timing target beyond the 24 hour window. |
| QC-3 | Compatibility | n/a: the existing text states no platform target for this FRD. |
| QC-4 | Interaction capability | n/a: the existing text states no interaction target beyond the one numbered message (FR-INTAKE-05-5). |
| QC-5 | Reliability | A question sent with the window closed is not sent and is listed again later (FR-INTAKE-05-6): the test closes the window, asks, and finds the question recorded as not sent. |
| QC-6 | Security | A token that does not match the chat id is refused and nothing is returned (FR-INTAKE-05-31): the test sends a mismatched token and finds nothing returned. |
| QC-7 | Maintainability | n/a: the existing text states no maintainability target beyond the repository rules. |
| QC-8 | Flexibility | n/a: the existing text states no change scenario for this FRD; removal of numbers is deferred (FR-INTAKE-05-23). |
| QC-9 | Safety | The go comes only from the owner's own words (FR-INTAKE-05-24): the test records a text not in the owner's message and finds nothing recorded. |

## Cross-cutting

n/a: docs/CROSS-CUTTING.md has no filled row for Intake; the cross-cutting rules live in docs/tp/TP.md.

## Edge cases

- The owner writes from an owner number that Deputy does not know: the message is a customer message, as FR-INTAKE-04-3 says. The owner adds the number first, with FR-INTAKE-05-17 and FR-INTAKE-05-18.
- Several questions are open: one message lists them numbered and the owner answers freely, in one message or several. The session decides which answer belongs to which question (FR-INTAKE-05-11).
- A question stays open until the session records an answer for it (FR-INTAKE-05-9). A second answer for the same question is refused (FR-INTAKE-05-10).
- The owner answers after the owner's window closed and reopened by that very message: the window is open again (FR-INTAKE-05-7).
- A question is sent while the provider is unreachable: the send fails as any send does (Intake TP-04, send states); no question is recorded.

## Information

- Control chat: the chat between the business number and an owner number that is not the business number (FR-INTAKE-05-1).
- Per open question: its id, the text, the time it was asked, the customer chat it names, and, once closed, the answer and its time (FR-INTAKE-05-5, FR-INTAKE-05-9, FR-INTAKE-05-25).
- Per customer chat: the time its customer 24 hour window closes (FR-INTAKE-05-12).
- Per day: the number of customer messages received and of owner questions asked, with no text (FR-INTAKE-05-27).
- Per customer chat: a triage token and the stored summary (FR-INTAKE-05-30 to FR-INTAKE-05-32).
- Business number and owner numbers (FR-INTAKE-05-15, FR-INTAKE-05-21).

## Open questions

Closed on 2026-11-25 (Proposed, lead): the business number when the provider offers none (FR-INTAKE-05-16) does not arise in the pilot, which uses Kapso only; FR-INTAKE-05-21 stops set_owner_numbers from setting it.

## Acceptance criteria

Generated from the examples above, one per EX row:

- AC-1: Given a chat between the business number and an owner number that is not the business number, When the control chat is read, Then it is the control chat. (EX-1)
- AC-2: Given a message's text names the owner, When Intake decides the chat kind, Then the owner numbers decide and the text does not. (EX-2)
- AC-3: Given the owner sends a message in the control chat, When it is recorded, Then it is an answer or instruction for the session and never a customer message. (EX-3)
- AC-4: Given a control chat message is recorded, When the pending list is read, Then no chat becomes pending because of it. (EX-4)
- AC-5: Given the owner sends a message in the control chat, When Intake checks sends, Then it holds no send. (EX-5)
- AC-6: Given an owner reply to a customer that Deputy cannot tie to a chat, When Intake checks sends, Then it holds sends, as D30 says. (EX-6)
- AC-7: Given the owner answers a customer from the WhatsApp Business app, When the reply is stored, Then it keeps source owner from the app and stays in the customer's chat. (EX-7)
- AC-8: Given the owner's app reply is stored, When Intake checks sends, Then it keeps holding sends as FR-INTAKE-04-11 and D30 say. (EX-8)
- AC-9: Given the session asks two questions with an owner number, When Intake sends them, Then one message lists both numbered, and each gets an id and the time. (EX-9)
- AC-10: Given the owner's window with the business number is closed, When the session asks questions, Then Intake sends nothing, records each question as not sent, and returns window closed with the ids. (EX-10)
- AC-11: Given the owner sent a message to the business number 10 hours ago, When the window is checked, Then it is open for 14 more hours. (EX-11)
- AC-12: Given the owner's latest message is more than 24 hours old, When the window is checked, Then it is closed. (EX-12)
- AC-13: Given a number is not an owner number, When Intake is asked to send a question to it, Then it sends nothing, records nothing and refuses. (EX-13)
- AC-14: Given a question names a chat that is not a stored customer chat, When Intake is asked to send it, Then it refuses with unknown chat and records nothing. (EX-14)
- AC-15: Given a question is open and the session records an answer with its id and the owner's text, When Intake records it, Then it closes that question and keeps the text with it. (EX-15)
- AC-16: Given the id is not an open question, When the session records an answer, Then Intake refuses and changes nothing. (EX-16)
- AC-17: Given the session reads the control chat, When it gets the messages, Then the owner's messages come with the open questions and their ids. (EX-17)
- AC-18: Given the owner's message answers two questions, When Intake reads it, Then Intake does not match it to a question; the session does. (EX-18)
- AC-19: Given a customer's latest message was 3 hours ago, When the chat is read, Then it shows when its window closes, 24 hours after that message. (EX-19)
- AC-20: Given a chat's latest customer message is older than the pending window, When the pending list is asked for, Then the chat is not listed. (EX-20)
- AC-21: Given the pending list is asked for, When it is produced, Then it holds no summary groups, no ignore list and no message text. (EX-21)
- AC-22: Given the control chat has a pending message, When the pending list is asked for, Then the control chat is never listed. (EX-22)
- AC-23: Given Deputy starts with Kapso and no business number is recorded, When Intake asks the provider, Then it records the connected number as the business number, logged with the command provider. (EX-23)
- AC-24: Given the provider offers no business number, When Intake is asked, Then it tells the session the business number is missing. (EX-24)
- AC-25: Given the session calls set_owner_numbers with a number and the owner's words, When Intake parses it, Then it writes nothing and returns the E.164 form, whether it is already an owner number, and the count of customer messages from it. (EX-25)
- AC-26: Given the session repeats the call after the owner agreed to the E.164 form, When Intake receives it, Then it adds the number and logs the change with the owner's words. (EX-26)
- AC-27: Given a number cannot be parsed or needs a country code, When Intake receives it, Then it refuses with the reason and writes nothing. (EX-27)
- AC-28: Given an owner number is recorded and the owner asks to remove it, When the pilot runs, Then removal is deferred and set_owner_numbers only adds numbers. (EX-28)
- AC-29: Given this process does not hold the lease, When Intake is asked to add an owner number, Then it refuses and writes nothing. (EX-29)
- AC-30: Given this process does not hold the lease, When Deputy starts, Then Intake records no business number. (EX-30)
- AC-31: Given the owner has answered a question, When Intake closes it, Then it hands Drafts the question id, the chat and the text. (EX-31)
- AC-32: Given Drafts was not running when an answer was given, When Drafts asks for the answered questions at start, Then the answer is returned, not lost. (EX-32)
- AC-33: Given the session records a text that the owner sent in the control chat after the question was asked, When Intake checks it, Then it records the answer. (EX-33)
- AC-34: Given the session records a text that is not in any owner message, When Intake checks it, Then it refuses, changes nothing and publishes nothing. (EX-34)
- AC-35: Given the session asks a question about a customer chat, When Intake records it, Then the chat id is recorded with the question. (EX-35)
- AC-36: Given a question names an owner's control chat, When Intake is asked to send it, Then it refuses with unknown chat. (EX-36)
- AC-37: Given Drafts or the session asks for the day's counts, When Intake answers, Then each day shows the number of customer messages and owner questions, counted once. (EX-37)
- AC-38: Given the day's counts are returned, When they are read, Then they hold no text, name or chat id. (EX-38)
- AC-39: Given the session asks for the pending chats, When Intake gives each chat a triage token, Then each chat has a token derived from its id and a secret Deputy keeps. (EX-39)
- AC-40: Given a helper asks for a chat's context with a token that does not match the chat id, When Intake is asked, Then the request is refused and nothing is returned. (EX-40)
- AC-41: Given a helper reads a chat's context, When Intake returns it, Then the messages are labeled customer text, and the summary is labeled as the model's earlier notes. (EX-41)
- AC-42: Given a chat's summary repeats a customer's words, When it is read, Then it is not labeled as the owner's words or as a go. (EX-42)
- AC-43: Given the dispatcher asks for the owner's answers, When Intake returns them, Then the control-chat messages since the oldest open question, and the open questions with their ids and text. (EX-43)
- AC-44: Given the dispatcher asks for the owner's answers and no question is open, When Intake returns them, Then none is returned, and no customer chat is included. (EX-44)
- AC-45: Given a pending chat with a customer message inside the window, When the pending list is shown, Then the list shows the chat and the time its window closes, and no message text. (EX-45)
- AC-46: Given a question is sent while the provider is unreachable, When the send fails, Then no question is recorded. (EX-46)

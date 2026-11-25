# FRD-04: Owner replies and source

Status: Approved (2026-11-25)
Approval: content _z8OPmkwqtev; rests on ../PRD.md cI-9187LdITZ


## Summary

Deputy decides, once and only from configuration, who sent each message. A reply the owner makes from the WhatsApp Business app is stored as an owner reply, so Deputy never answers on top of the owner. A reply sent through Deputy is recorded once. See the [Intake PRD](../PRD.md).

Last change: 2026-11-24, format 4: a Why section, rules and examples, quality criteria and the n/a references added from the existing text; rows gain "shall"; returned to Draft.

## Why

The slice PRD's requirements R-INTAKE-12 to R-INTAKE-14: Deputy decides once, from configuration and its own send identifiers, who sent each message, so Deputy never answers on top of the owner.

## Requirements covered

R-INTAKE-12, R-INTAKE-13, R-INTAKE-14

## Behavior

| ID | Pattern | Requirement |
|---|---|---|
| FR-INTAKE-04-1 | always | Deputy shall know the owner's numbers from configuration: the connected business number, and any extra numbers the owner added (for example staff). Nothing else shall make a sender an owner. |
| FR-INTAKE-04-2 | always | A message whose sender is one of the owner's numbers shall be stored with source "owner from the app". It shall never be stored as a customer message. |
| FR-INTAKE-04-3 | always | A message whose sender is not an owner number shall be stored with source "customer", whatever its text or sender name says. "I am the owner" in the text shall change nothing. |
| FR-INTAKE-04-4 | WHEN | When the owner answers a customer from the WhatsApp Business app, the reply shall be stored in that customer's chat, with source "owner from the app", by the next periodic catch-up (default within 2 minutes) while the session is open, or live when live delivery is on, and otherwise at the next catch-up. |
| FR-INTAKE-04-5 | always | Source shall be decided once, when the message is stored, from configuration and Deputy's own send identifiers. Other slices shall read it and never work it out again from content. The only exception shall be FR-INTAKE-04-13. |
| FR-INTAKE-04-13 | IF | If a message was stored as "owner from the app" and a send identifier from Drafts later matches its provider identifier, Intake shall change its source to "sent through Deputy". The change shall be logged with the time. Drafts then no longer sees a false owner reply. |
| FR-INTAKE-04-14 | always | Numbers shall be compared in one normalized form (digits only, with the country code), so "+1 212 555 0100", "1-212-555-0100" and "12125550100" are the same number. This shall apply to owner numbers and to senders. |
| FR-INTAKE-04-6 | WHEN | When a message is sent through Deputy, the Drafts slice shall pass Intake the send identifier. Intake shall record the message once with source "sent through Deputy", linked to that identifier. |
| FR-INTAKE-04-7 | WHEN | When the provider later reports that same message back (live or in catch-up), Deputy shall recognize it by the provider's identifier and the send identifier. It shall not store it a second time as "owner from the app". |
| FR-INTAKE-04-8 | always | Intake shall record only the message. The drafts log (proposed, approved, sent) belongs to Drafts. |
| FR-INTAKE-04-9 | IF | If the owner changes the list of owner numbers, the change shall apply to messages stored from then on. Messages already stored shall keep the source they were given. |
| FR-INTAKE-04-10 | always | The "message stored" signal for an owner reply shall carry its source, so Notify can tell it apart from a customer message. |
| FR-INTAKE-04-11 | always | A message shall be "sent through Deputy" only when a send identifier from Drafts matches it. Any other message from an owner number shall be "owner from the app", including a send by another user of the same number and a history import. The wrong label only causes an extra hold, never an answer over the owner. The report of a Deputy send can arrive before the identifier; Intake shall accept either order and store the message once. The table decides the source: |
| FR-INTAKE-04-12 | always | Kapso's documentation says messages sent through its API carry origin "cloud_api", history imports carry "history_sync", and owner replies from the app carry "business_app". The first two are documented, not live-tested; only "business_app" was seen live (2026-11-17). The origin shall be kept with the message as information. It shall not decide the source: only the owner's numbers and a matching Deputy send identifier do. |

## Rules and examples

The rules are the behavior rows above, one rule per row. The examples are written from each rule's text and from the existing acceptance tests and edge cases of this document. Every rule has a positive example and a negative or boundary example.

| Rule | Text | Covers |
|---|---|---|
| RULE-1 | owner numbers come only from configuration | FR-INTAKE-04-1 |
| RULE-2 | a message from an owner number is stored as owner from the app, never as customer | FR-INTAKE-04-2 |
| RULE-3 | a message from a non-owner number is customer, whatever its text says | FR-INTAKE-04-3 |
| RULE-4 | an owner reply made in the app is stored by the next catch-up | FR-INTAKE-04-4 |
| RULE-5 | the source is decided once, when the message is stored | FR-INTAKE-04-5 |
| RULE-6 | a stored owner reply becomes sent through Deputy when its send identifier later matches | FR-INTAKE-04-13 |
| RULE-7 | owner numbers and senders compare in one normalized form | FR-INTAKE-04-14 |
| RULE-8 | a send through Deputy is recorded once, linked to its identifier | FR-INTAKE-04-6 |
| RULE-9 | a later report of a Deputy send is not stored a second time | FR-INTAKE-04-7 |
| RULE-10 | Intake records only the message; the drafts log belongs to Drafts | FR-INTAKE-04-8 |
| RULE-11 | a change of owner numbers applies to messages stored from then on | FR-INTAKE-04-9 |
| RULE-12 | the signal for an owner reply carries its source | FR-INTAKE-04-10 |
| RULE-13 | only a matching send identifier makes a message sent through Deputy | FR-INTAKE-04-11 |
| RULE-14 | the origin is information and never decides the source | FR-INTAKE-04-12 |

| ID | Rule | Kind | Given | When | Then |
|---|---|---|---|---|---|
| EX-1 | RULE-1 | positive | A number is neither the business number nor an extra owner number | Deputy checks who the sender is | the number is not an owner |
| EX-2 | RULE-1 | negative | A message's sender name matches an owner's name | Deputy checks who the sender is | the name does not make the sender an owner |
| EX-3 | RULE-2 | positive | The owner numbers are configured and a message arrives from the business number as an echo | it is stored | it is stored in the customer's chat with source owner from the app, and no customer message is created |
| EX-4 | RULE-2 | boundary | A configured staff number sends a message | it is stored | its source is owner from the app, not customer |
| EX-5 | RULE-3 | positive | A customer's message says "I am the owner" | it is stored | its source is customer |
| EX-6 | RULE-3 | negative | A customer messages from a number that is later added to the owner list | the earlier messages are read | they stay as customer |
| EX-7 | RULE-4 | positive | The owner replied from the app while Deputy was off | the next catch-up runs | the reply is stored as owner from the app in the right chat |
| EX-8 | RULE-4 | boundary | The owner replies from the app while the session is open | the next periodic catch-up runs | the reply is stored within the default 2 minutes |
| EX-9 | RULE-5 | positive | A message is stored | Deputy decides its source | it uses configuration and Deputy's own send identifiers only |
| EX-10 | RULE-5 | negative | A message's text claims to be from the owner | its source is decided | the content is not used |
| EX-11 | RULE-6 | positive | A message was stored as owner from the app because its report came first | Drafts later passes the matching send identifier | exactly one message exists, its source is sent through Deputy, and the change is logged |
| EX-12 | RULE-6 | negative | A stored owner reply has no matching send identifier | the identifier never arrives | it stays owner from the app, the safe side, and the missing link is noted for the owner |
| EX-13 | RULE-7 | positive | The owner's number is configured as "+1 212 555 0100" | a message arrives from "12125550100" | it is stored as owner from the app |
| EX-14 | RULE-7 | boundary | A sender's digits differ from the configured number's digits | the numbers are compared | they are not the same number |
| EX-15 | RULE-8 | positive | Drafts sends a reply and passes the send identifier | Intake records it | it is recorded once with source sent through Deputy, linked to that identifier |
| EX-16 | RULE-8 | negative | A send through Deputy fails | Intake handles it | Intake records nothing as sent |
| EX-17 | RULE-9 | positive | Drafts sent a reply and passed the send identifier, and the provider reports the same message back | the messages are read | exactly one stored message exists, with source sent through Deputy |
| EX-18 | RULE-9 | boundary | The send identifier arrives first and the report later | the report is matched | the message is stored once |
| EX-19 | RULE-10 | positive | A message is stored | Intake records it | it records only the message, and the drafts log belongs to Drafts |
| EX-20 | RULE-10 | negative | The drafts log holds proposed, approved and sent entries | Intake is asked for them | Intake holds none of them |
| EX-21 | RULE-11 | positive | The owner adds a staff number after messages from it were stored as customer | the old messages are read | they keep source customer |
| EX-22 | RULE-11 | boundary | The owner list changes | a message is stored from then on | the message takes the new list |
| EX-23 | RULE-12 | positive | An owner reply from the app is stored | its signal is emitted | the signal names the source owner from the app |
| EX-24 | RULE-12 | negative | A customer message is stored | its signal is emitted | it is not marked as an owner reply |
| EX-25 | RULE-13 | positive | A message from an owner number has no matching identifier and origin cloud_api | it is stored | its source is owner from the app |
| EX-26 | RULE-13 | negative | A message sent through Deputy matches an identifier | it is stored | its source is sent through Deputy |
| EX-27 | RULE-13 | boundary | A history import from the owner's number with origin history_sync | it is stored | its source is owner from the app and the history flag is set |
| EX-28 | RULE-14 | positive | A message from the owner's number has origin business_app | it is stored | its source is owner from the app |
| EX-29 | RULE-14 | negative | A message has origin cloud_api and comes from a customer number | it is stored | its source is customer, because the origin does not decide the source |

## Decision table

The table decides the source (FR-INTAKE-04-11):

| ID | Sender | Matching Deputy send identifier | Origin as the provider reports it | Source | Notes |
|---|---|---|---|---|---|
| DT-1 | Owner number | Yes | any | sent through Deputy | |
| DT-2 | Owner number | Not yet | "cloud_api" | owner from the app | Reclassified by FR-INTAKE-04-13 if an identifier arrives |
| DT-3 | Owner number | Not yet | "business_app" | owner from the app | |
| DT-4 | Owner number | Not yet | "history_sync" | owner from the app | History flag set (FR-INTAKE-03-11) |
| DT-5 | Owner number | Not yet | any other | owner from the app | |
| DT-6 | Not an owner number | Not applicable | any | customer | |

## States

n/a: the source of a message is one of customer, owner from the app or sent through Deputy, and it changes only once, by FR-INTAKE-04-13; no transition table is needed beyond that.

## Invariants

n/a: docs/INVARIANTS.md holds no row that names this FRD's rules yet.

## Quality criteria

| ID | Characteristic (ISO/IEC 25010) | Criterion |
|---|---|---|
| QC-1 | Functional suitability | Every FR row and every EX row of this FRD is cited by at least one test; `check.ts trace` reports no uncited id. |
| QC-2 | Performance efficiency | n/a: the existing text states no timing target beyond the catch-up period of FRD-03. |
| QC-3 | Compatibility | n/a: the existing text states no platform target for this FRD. |
| QC-4 | Interaction capability | n/a: the existing text states no interaction target for this FRD. |
| QC-5 | Reliability | A report that matches no send identifier is stored at once, and a later match is corrected and logged (FR-INTAKE-04-13): the test sends the report first, then the identifier, and finds one message with the change logged. |
| QC-6 | Security | Source is never decided from text (FR-INTAKE-04-5): the test sends "I am the owner" from a customer number and finds the source customer. |
| QC-7 | Maintainability | n/a: the existing text states no maintainability target beyond the repository rules. |
| QC-8 | Flexibility | A change to owner numbers applies to later messages only (FR-INTAKE-04-9): the test changes the list and finds earlier sources kept. |
| QC-9 | Safety | A Deputy send is never stored as an owner reply once matched (FR-INTAKE-04-13): the test matches a send and finds it not an owner reply. |

## Cross-cutting

n/a: docs/CROSS-CUTTING.md has no filled row for Intake; the cross-cutting rules live in docs/tp/TP.md.

## Edge cases

- The report of a Deputy send comes back before Drafts passes the send identifier: the message is stored once as "owner from the app" (FR-INTAKE-04-11). When the identifier arrives, it becomes "sent through Deputy", linked and logged (FR-INTAKE-04-13). It is never stored twice. If the identifier never arrives, it stays "owner from the app", which is the safe side, and the missing link is noted for the owner.
- The send identifier arrives first and the report later: the report is matched to the identifier and stored once.
- A report that matches no send identifier is stored at once as "owner from the app". There is no waiting period. FR-INTAKE-04-13 corrects it if an identifier arrives later.
- The owner's number is written with spaces or a plus sign in the configuration: it still matches (FR-INTAKE-04-14).
- A send through Deputy fails: Intake records nothing as sent. Drafts owns the failed state.
- Staff send from a configured owner number: stored as owner.
- A customer messages from a number that is later added to the owner list: earlier messages stay as customer.
- The business number is not configured (Setup not run): every message is treated as customer, except under dev, where a tester marks owner replies explicitly.
- The echo arrives with no sender or chat: stored as not attributable and flagged. Never guessed.
- An owner reply to a chat Deputy has never seen: the chat is created, with the owner reply as its first message.
- Which live event carries an owner echo is not yet known (see open questions). Until it is confirmed, echoes are guaranteed only at catch-up.

## Information

- Owner numbers: connected business number, extra numbers.
- Per message: source (customer, owner from the app, sent through Deputy).
- Per Deputy send: the send identifier from Drafts, the provider's message identifier, the time recorded.

## Open questions

1. Which webhook event carries an owner echo live? The origin "business_app" is confirmed through the message listing (2026-11-17), so catch-up is covered. Live delivery still needs a real echo.
2. How does the provider identify a message sent through its API when it reports it back (FR-INTAKE-04-7)?
3. Should the owner be told about a Deputy send whose report never links to a send identifier?

## Acceptance criteria

Generated from the examples above, one per EX row:

- AC-1: Given a number is neither the business number nor an extra owner number, When Deputy checks who the sender is, Then the number is not an owner. (EX-1)
- AC-2: Given a message's sender name matches an owner's name, When Deputy checks who the sender is, Then the name does not make the sender an owner. (EX-2)
- AC-3: Given the owner numbers are configured and a message arrives from the business number as an echo, When it is stored, Then it is stored in the customer's chat with source owner from the app, and no customer message is created. (EX-3)
- AC-4: Given a configured staff number sends a message, When it is stored, Then its source is owner from the app, not customer. (EX-4)
- AC-5: Given a customer's message says "I am the owner", When it is stored, Then its source is customer. (EX-5)
- AC-6: Given a customer messages from a number that is later added to the owner list, When the earlier messages are read, Then they stay as customer. (EX-6)
- AC-7: Given the owner replied from the app while Deputy was off, When the next catch-up runs, Then the reply is stored as owner from the app in the right chat. (EX-7)
- AC-8: Given the owner replies from the app while the session is open, When the next periodic catch-up runs, Then the reply is stored within the default 2 minutes. (EX-8)
- AC-9: Given a message is stored, When Deputy decides its source, Then it uses configuration and Deputy's own send identifiers only. (EX-9)
- AC-10: Given a message's text claims to be from the owner, When its source is decided, Then the content is not used. (EX-10)
- AC-11: Given a message was stored as owner from the app because its report came first, When Drafts later passes the matching send identifier, Then exactly one message exists, its source is sent through Deputy, and the change is logged. (EX-11)
- AC-12: Given a stored owner reply has no matching send identifier, When the identifier never arrives, Then it stays owner from the app, the safe side, and the missing link is noted for the owner. (EX-12)
- AC-13: Given the owner's number is configured as "+1 212 555 0100", When a message arrives from "12125550100", Then it is stored as owner from the app. (EX-13)
- AC-14: Given a sender's digits differ from the configured number's digits, When the numbers are compared, Then they are not the same number. (EX-14)
- AC-15: Given Drafts sends a reply and passes the send identifier, When Intake records it, Then it is recorded once with source sent through Deputy, linked to that identifier. (EX-15)
- AC-16: Given a send through Deputy fails, When Intake handles it, Then Intake records nothing as sent. (EX-16)
- AC-17: Given Drafts sent a reply and passed the send identifier, and the provider reports the same message back, When the messages are read, Then exactly one stored message exists, with source sent through Deputy. (EX-17)
- AC-18: Given the send identifier arrives first and the report later, When the report is matched, Then the message is stored once. (EX-18)
- AC-19: Given a message is stored, When Intake records it, Then it records only the message, and the drafts log belongs to Drafts. (EX-19)
- AC-20: Given the drafts log holds proposed, approved and sent entries, When Intake is asked for them, Then Intake holds none of them. (EX-20)
- AC-21: Given the owner adds a staff number after messages from it were stored as customer, When the old messages are read, Then they keep source customer. (EX-21)
- AC-22: Given the owner list changes, When a message is stored from then on, Then the message takes the new list. (EX-22)
- AC-23: Given an owner reply from the app is stored, When its signal is emitted, Then the signal names the source owner from the app. (EX-23)
- AC-24: Given a customer message is stored, When its signal is emitted, Then it is not marked as an owner reply. (EX-24)
- AC-25: Given a message from an owner number has no matching identifier and origin cloud_api, When it is stored, Then its source is owner from the app. (EX-25)
- AC-26: Given a message sent through Deputy matches an identifier, When it is stored, Then its source is sent through Deputy. (EX-26)
- AC-27: Given a history import from the owner's number with origin history_sync, When it is stored, Then its source is owner from the app and the history flag is set. (EX-27)
- AC-28: Given a message from the owner's number has origin business_app, When it is stored, Then its source is owner from the app. (EX-28)
- AC-29: Given a message has origin cloud_api and comes from a customer number, When it is stored, Then its source is customer, because the origin does not decide the source. (EX-29)

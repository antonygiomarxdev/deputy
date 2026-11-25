# FRD-04: Owner replies and source

Status: Approved (2026-11-18)

## Summary

Deputy decides, once and only from configuration, who sent each message. A reply the owner makes from the WhatsApp Business app is stored as an owner reply, so Deputy never answers on top of the owner. A reply sent through Deputy is recorded once. See the [Intake PRD](../PRD.md).

## Requirements covered

R-INTAKE-12, R-INTAKE-13, R-INTAKE-14

## Behavior

| ID | Pattern | Requirement |
|---|---|---|
| FR-INTAKE-04-1 | always | Deputy knows the owner's numbers from configuration: the connected business number, and any extra numbers the owner added (for example staff). Nothing else makes a sender an owner. |
| FR-INTAKE-04-2 | always | A message whose sender is one of the owner's numbers is stored with source "owner from the app". It is never stored as a customer message. |
| FR-INTAKE-04-3 | always | A message whose sender is not an owner number is stored with source "customer", whatever its text or sender name says. "I am the owner" in the text changes nothing. |
| FR-INTAKE-04-4 | WHEN | When the owner answers a customer from the WhatsApp Business app, the reply is stored in that customer's chat, with source "owner from the app", by the next periodic catch-up (default within 2 minutes) while the session is open, or live when live delivery is on, and otherwise at the next catch-up. |
| FR-INTAKE-04-5 | always | Source is decided once, when the message is stored, from configuration and Deputy's own send identifiers. Other slices read it and never work it out again from content. The only exception is FR-INTAKE-04-13. |
| FR-INTAKE-04-13 | IF | If a message was stored as "owner from the app" and a send identifier from Drafts later matches its provider identifier, Intake changes its source to "sent through Deputy". The change is logged with the time. Drafts then no longer sees a false owner reply. |
| FR-INTAKE-04-14 | always | Numbers are compared in one normalized form (digits only, with the country code), so "+1 212 555 0100", "1-212-555-0100" and "12125550100" are the same number. This applies to owner numbers and to senders. |
| FR-INTAKE-04-6 | WHEN | When a message is sent through Deputy, the Drafts slice passes Intake the send identifier. Intake records the message once with source "sent through Deputy", linked to that identifier. |
| FR-INTAKE-04-7 | WHEN | When the provider later reports that same message back (live or in catch-up), Deputy recognizes it by the provider's identifier and the send identifier. It does not store it a second time as "owner from the app". |
| FR-INTAKE-04-8 | always | Intake records only the message. The drafts log (proposed, approved, sent) belongs to Drafts. |
| FR-INTAKE-04-9 | IF | If the owner changes the list of owner numbers, the change applies to messages stored from then on. Messages already stored keep the source they were given. |
| FR-INTAKE-04-10 | always | The "message stored" signal for an owner reply carries its source, so Notify can tell it apart from a customer message. |
| FR-INTAKE-04-11 | always | A message is "sent through Deputy" only when a send identifier from Drafts matches it. Any other message from an owner number is "owner from the app", including a send by another user of the same number and a history import. The wrong label only causes an extra hold, never an answer over the owner. The report of a Deputy send can arrive before the identifier; Intake accepts either order and stores the message once. The table decides the source: |

  | Sender | Matching Deputy send identifier | Origin as the provider reports it | Source | Notes |
  |---|---|---|---|---|
  | Owner number | Yes | any | sent through Deputy | |
  | Owner number | Not yet | "cloud_api" | owner from the app | Reclassified by FR-INTAKE-04-13 if an identifier arrives |
  | Owner number | Not yet | "business_app" | owner from the app | |
  | Owner number | Not yet | "history_sync" | owner from the app | History flag set (FR-INTAKE-03-11) |
  | Owner number | Not yet | any other | owner from the app | |
  | Not an owner number | Not applicable | any | customer | |

| ID | Pattern | Requirement |
|---|---|---|
| FR-INTAKE-04-12 | always | Kapso's documentation says messages sent through its API carry origin "cloud_api", history imports carry "history_sync", and owner replies from the app carry "business_app". The first two are documented, not live-tested; only "business_app" was seen live (2026-11-17). The origin is kept with the message as information. It does not decide the source: only the owner's numbers and a matching Deputy send identifier do. |

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

## Acceptance tests

- Given the owner's numbers are configured, When a message arrives from the business number as an echo, Then it is stored in the customer's chat with source "owner from the app" and no customer message is created. Tests FR-INTAKE-04-2 and FR-INTAKE-04-4.
- Given a customer's message says "I am the owner", When it is stored, Then its source is "customer". Tests FR-INTAKE-04-3.
- Given a message arrives from a configured staff number, When it is stored, Then its source is "owner from the app". Tests FR-INTAKE-04-1 and FR-INTAKE-04-2.
- Given Drafts sent a reply and passed the send identifier, When the provider reports the same message back, Then exactly one stored message exists, with source "sent through Deputy". Tests FR-INTAKE-04-6 and FR-INTAKE-04-7.
- Given the owner replied from the app while Deputy was off, When the next catch-up runs, Then the reply is stored as "owner from the app" in the right chat. Tests FR-INTAKE-04-4.
- Given the owner adds a staff number after messages from it were stored as customer, When the old messages are read, Then they keep source "customer". Tests FR-INTAKE-04-9.
- Given the provider reports a message from the owner's number with origin "cloud_api" that matches no known send identifier, When it is stored, Then its source is "owner from the app". Tests FR-INTAKE-04-11.
- Given a message was stored as "owner from the app" because its report came first, When Drafts later passes the matching send identifier, Then exactly one message exists, its source is "sent through Deputy", and the change is logged. Tests FR-INTAKE-04-13.
- Given the owner's number is configured as "+1 212 555 0100", When a message arrives from "12125550100", Then it is stored as "owner from the app". Tests FR-INTAKE-04-14.
- Given the provider reports a message with origin "business_app" from the owner's number, When it is stored, Then its source is "owner from the app". Tests FR-INTAKE-04-12 and FR-INTAKE-04-2.
- Given a history import from the owner's number with origin "history_sync", When it is stored, Then its source is "owner from the app" and the history flag is set. Tests FR-INTAKE-04-11.
- Given an owner reply from the app is stored, When the signal is emitted, Then it names the source "owner from the app". Tests FR-INTAKE-04-10.

## Open questions

1. Which webhook event carries an owner echo live? The origin "business_app" is confirmed through the message listing (2026-11-17), so catch-up is covered. Live delivery still needs a real echo.
2. How does the provider identify a message sent through its API when it reports it back (FR-INTAKE-04-7)?
3. Should the owner be told about a Deputy send whose report never links to a send identifier?

# FRD-01: Providers

Status: Approved (2026-11-25)
Approval: content 2fjCdf6zb9nI; rests on ../PRD.md cI-9187LdITZ


## Summary

The owner picks where messages come from: Kapso (the owner's real WhatsApp Business number) or dev (a local practice source with no WhatsApp). Changing the choice changes nothing else in Deputy. The dev source lets anyone test every other feature without WhatsApp. See the [Intake PRD](../PRD.md).

Last change: 2026-11-24, format 4: a Why section, rules and examples, quality criteria and the n/a references added from the existing text; rows gain "shall"; returned to Draft.

## Why

The slice PRD's requirements R-INTAKE-1 and R-INTAKE-2: the owner picks where messages come from, the choice changes nothing else in Deputy, and the dev source lets every other feature be tested without WhatsApp.

## Requirements covered

R-INTAKE-1, R-INTAKE-2

## Behavior

| ID | Pattern | Requirement |
|---|---|---|
| FR-INTAKE-01-1 | always | Deputy shall have one setting that names the message source. v1 shall accept two values: Kapso and dev. Any other value shall be refused at start with a plain message that lists the two valid values. |
| FR-INTAKE-01-2 | WHERE | With Kapso, Deputy shall receive and retrieve messages for the owner's connected WhatsApp Business number through Kapso's official route. |
| FR-INTAKE-01-3 | WHERE | With dev, a tester shall be able to create, on demand, an inbound customer message (chat, sender number, text, type, optional transcript, send time) and an owner reply from the app. |
| FR-INTAKE-01-4 | always | A message created through dev shall be stored with the same fields and the same source marking as a message from Kapso (see FRD-02). The other slices shall not be able to tell which source produced a message, except by the provider's own identifier. |
| FR-INTAKE-01-5 | always | Dev shall support the cases the other features need: unreadable types, a transcript, a repeated message, messages out of order, an owner reply, a history message, and a message that fails the authenticity check. |
| FR-INTAKE-01-6 | always | Dev shall also be able to act as a source that has "missed" messages: a tester shall be able to add messages that Deputy has not yet stored, so catch-up (FRD-03) can be tested. |
| FR-INTAKE-01-7 | always | Switching the setting from dev to Kapso (or back) shall not delete stored messages and shall not require a change in any other slice. Stored messages shall keep the identifier of the provider that produced them. |
| FR-INTAKE-01-11 | WHERE | With Kapso, Deputy shall receive by catch-up by default and shall need no public address. The owner can switch on live delivery as an advanced setting (FR-INTAKE-03-16). Both settings (catch-up period, live delivery on or off) shall be read at start. |
| FR-INTAKE-01-9 | always | The ways to create test messages and forged deliveries (FR-INTAKE-01-3, 01-5, 01-6) shall exist only while the setting is dev. With Kapso, they shall be absent, and any attempt to use them shall be refused and noted. Nobody shall be able to inject a message into a Kapso setup this way. |
| FR-INTAKE-01-10 | WHILE | Once the setting is Kapso, stored messages from dev shall never be counted as pending, never counted in a notice, and never offered a draft. They shall stay readable and be marked "dev". The Inbox, Notify and Drafts slices rely on this. |
| FR-INTAKE-01-8 | WHILE | Until Setup has supplied Kapso connection details and the owner's numbers, only dev shall work. Choosing Kapso without them shall be refused at start with a message that says what is missing and points to Setup. |

## Rules and examples

The rules are the behavior rows above, one rule per row. The examples are written from each rule's text and from the existing acceptance tests and edge cases of this document. Every rule has a positive example and a negative or boundary example.

| Rule | Text | Covers |
|---|---|---|
| RULE-1 | the setting names only Kapso or dev | FR-INTAKE-01-1 |
| RULE-2 | with Kapso, Deputy receives through Kapso's route; with dev, a tester creates messages on demand | FR-INTAKE-01-2, FR-INTAKE-01-3 |
| RULE-3 | a dev message and a Kapso message carry the same fields and source meaning | FR-INTAKE-01-4 |
| RULE-4 | dev supports the cases the other features need and can act as a source with missed messages | FR-INTAKE-01-5, FR-INTAKE-01-6 |
| RULE-5 | switching the setting keeps stored messages | FR-INTAKE-01-7 |
| RULE-6 | with Kapso, Deputy receives by catch-up by default and needs no public address | FR-INTAKE-01-11 |
| RULE-7 | test messages and forged deliveries exist only while the setting is dev | FR-INTAKE-01-9 |
| RULE-8 | dev messages are never pending, noticed or drafted once the setting is Kapso | FR-INTAKE-01-10 |
| RULE-9 | Kapso needs connection details and owner numbers before it works | FR-INTAKE-01-8 |

| ID | Rule | Kind | Given | When | Then |
|---|---|---|---|---|---|
| EX-1 | RULE-1 | positive | The setting names a source that is not Kapso or dev | Deputy starts | it refuses to start and lists the two valid values |
| EX-2 | RULE-1 | boundary | The setting is empty | Deputy starts | it uses dev and says so, and it never guesses Kapso |
| EX-3 | RULE-2 | positive | The dev source is set | a tester creates a customer message with the text "How much is the cake?" | it is stored with all the fields of FRD-02 and is readable by the Inbox slice |
| EX-4 | RULE-2 | negative | A tester creates a dev message with no chat or no sender | the message is stored | it is rejected with a message that names the missing field |
| EX-5 | RULE-3 | positive | A dev message and a Kapso message with the same text and chat | another slice reads them | both have the same fields and the same source meaning |
| EX-6 | RULE-3 | negative | The same identifier arrives from both providers | the messages are read | they are told apart by provider plus identifier, so neither replaces the other |
| EX-7 | RULE-4 | positive | The dev source is set | a tester adds a message Deputy has not yet stored | catch-up can be tested with it |
| EX-8 | RULE-4 | boundary | The dev source is set | a tester creates a voice note with a transcript | it is stored as a customer message of type voice note, with the transcript |
| EX-9 | RULE-5 | positive | Dev messages are stored and the owner switches the setting to Kapso | the owner reads the messages | the dev messages are still there and are marked as from dev |
| EX-10 | RULE-5 | negative | A switch from dev to Kapso is made | the other slices read the stored messages | no other slice needs a change |
| EX-11 | RULE-6 | positive | Kapso is chosen and no live delivery is switched on | Deputy starts | it receives by catch-up and needs no public address |
| EX-12 | RULE-6 | boundary | Live delivery is off | Deputy starts | no public address is needed |
| EX-13 | RULE-7 | positive | The setting is Kapso | someone tries to create a test message or a forged delivery | it is refused, nothing is stored, and the attempt is noted |
| EX-14 | RULE-7 | negative | The setting is dev | a tester creates a test message | it is accepted |
| EX-15 | RULE-8 | positive | A stored dev message from a customer nobody answered, and the setting is now Kapso | the owner asks what is pending | that chat is not pending and no notice counts it |
| EX-16 | RULE-8 | boundary | The setting is still dev | the owner asks what is pending | this rule does not apply yet |
| EX-17 | RULE-9 | positive | Kapso is chosen and no connection details exist | Deputy starts | it refuses and says the details are missing |
| EX-18 | RULE-9 | negative | The setting is dev and no connection details exist | Deputy starts | dev works |

## Decision table

n/a: the setting has two values and each value sets one behavior (FR-INTAKE-01-1), so no decision table is needed.

## States

n/a: the setting is either Kapso or dev (FR-INTAKE-01-1); the switch between them is covered by FR-INTAKE-01-7 and FR-INTAKE-01-8, so no transition table is needed.

## Invariants

n/a: docs/INVARIANTS.md holds no row that names this FRD's rules yet.

## Quality criteria

| ID | Characteristic (ISO/IEC 25010) | Criterion |
|---|---|---|
| QC-1 | Functional suitability | Every FR row and every EX row of this FRD is cited by at least one test; `check.ts trace` reports no uncited id. |
| QC-2 | Performance efficiency | n/a: the existing text states no timing target for the source setting. |
| QC-3 | Compatibility | n/a: the existing text states no platform target beyond the two values of the setting. |
| QC-4 | Interaction capability | n/a: the existing text states no interaction target. |
| QC-5 | Reliability | Switching the setting keeps stored messages (FR-INTAKE-01-7): the test switches the setting both ways and finds every stored message still there. |
| QC-6 | Security | Connection details and owner numbers are never shown in chat (Information): the test searches the chat output for them and finds none. |
| QC-7 | Maintainability | n/a: the existing text states no maintainability target beyond the repository rules. |
| QC-8 | Flexibility | A switch in either direction changes no other slice (FR-INTAKE-01-7): the test switches both ways and finds no other slice changed. |
| QC-9 | Safety | Dev messages are never pending, noticed or drafted once the setting is Kapso (FR-INTAKE-01-10): the test switches and finds the dev chat not pending. |

## Cross-cutting

n/a: docs/CROSS-CUTTING.md has no filled row for Intake; the cross-cutting rules live in docs/tp/TP.md.

## Edge cases

- The setting is empty: Deputy uses dev and says so at start. It never guesses Kapso.
- The owner switches to Kapso while dev test messages are stored: the test messages stay. Deputy marks them as from dev, so the owner can tell test data from real data.
- Kapso details are present but wrong: this is a connection failure, handled by catch-up status (FRD-03), not a setting error.
- The same identifier arrives from both providers (a coincidence): messages are told apart by provider plus identifier, so neither replaces the other.
- A tester creates a dev message with a missing field (no chat or no sender): it is rejected with a message that names the missing field.

## Information

- Provider setting: the chosen source.
- Provider connection details and owner numbers: supplied by Setup, read here, never shown in chat.
- Per stored message: which provider produced it.

## Open questions

1. Should the owner also be able to delete dev test data in one step? It is hidden from the inbox either way (FR-INTAKE-01-10).

## Acceptance criteria

Generated from the examples above, one per EX row:

- AC-1: Given the setting names a source that is not Kapso or dev, When Deputy starts, Then it refuses to start and lists the two valid values. (EX-1)
- AC-2: Given the setting is empty, When Deputy starts, Then it uses dev and says so, and it never guesses Kapso. (EX-2)
- AC-3: Given the dev source is set, When a tester creates a customer message with the text "How much is the cake?", Then it is stored with all the fields of FRD-02 and is readable by the Inbox slice. (EX-3)
- AC-4: Given a tester creates a dev message with no chat or no sender, When the message is stored, Then it is rejected with a message that names the missing field. (EX-4)
- AC-5: Given a dev message and a Kapso message with the same text and chat, When another slice reads them, Then both have the same fields and the same source meaning. (EX-5)
- AC-6: Given the same identifier arrives from both providers, When the messages are read, Then they are told apart by provider plus identifier, so neither replaces the other. (EX-6)
- AC-7: Given the dev source is set, When a tester adds a message Deputy has not yet stored, Then catch-up can be tested with it. (EX-7)
- AC-8: Given the dev source is set, When a tester creates a voice note with a transcript, Then it is stored as a customer message of type voice note, with the transcript. (EX-8)
- AC-9: Given dev messages are stored and the owner switches the setting to Kapso, When the owner reads the messages, Then the dev messages are still there and are marked as from dev. (EX-9)
- AC-10: Given a switch from dev to Kapso is made, When the other slices read the stored messages, Then no other slice needs a change. (EX-10)
- AC-11: Given Kapso is chosen and no live delivery is switched on, When Deputy starts, Then it receives by catch-up and needs no public address. (EX-11)
- AC-12: Given live delivery is off, When Deputy starts, Then no public address is needed. (EX-12)
- AC-13: Given the setting is Kapso, When someone tries to create a test message or a forged delivery, Then it is refused, nothing is stored, and the attempt is noted. (EX-13)
- AC-14: Given the setting is dev, When a tester creates a test message, Then it is accepted. (EX-14)
- AC-15: Given a stored dev message from a customer nobody answered, and the setting is now Kapso, When the owner asks what is pending, Then that chat is not pending and no notice counts it. (EX-15)
- AC-16: Given the setting is still dev, When the owner asks what is pending, Then this rule does not apply yet. (EX-16)
- AC-17: Given Kapso is chosen and no connection details exist, When Deputy starts, Then it refuses and says the details are missing. (EX-17)
- AC-18: Given the setting is dev and no connection details exist, When Deputy starts, Then dev works. (EX-18)

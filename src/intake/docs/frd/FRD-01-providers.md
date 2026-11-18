# FRD-01: Providers

Status: Approved (2026-11-18)

## Summary

The owner picks where messages come from: Kapso (the owner's real WhatsApp Business number) or dev (a local practice source with no WhatsApp). Changing the choice changes nothing else in Deputy. The dev source lets anyone test every other feature without WhatsApp. See the [Intake PRD](../PRD.md).

## Requirements covered

R-INTAKE-1, R-INTAKE-2

## Behavior

- **FR-INTAKE-01-1.** Deputy has one setting that names the message source. v1 accepts two values: Kapso and dev. Any other value is refused at start with a plain message that lists the two valid values.
- **FR-INTAKE-01-2.** With Kapso, Deputy receives and retrieves messages for the owner's connected WhatsApp Business number through Kapso's official route.
- **FR-INTAKE-01-3.** With dev, a tester can create, on demand, an inbound customer message (chat, sender number, text, type, optional transcript, send time) and an owner reply from the app.
- **FR-INTAKE-01-4.** A message created through dev is stored with the same fields and the same source marking as a message from Kapso (see FRD-02). The other slices cannot tell which source produced a message, except by the provider's own identifier.
- **FR-INTAKE-01-5.** Dev supports the cases the other features need: unreadable types, a transcript, a repeated message, messages out of order, an owner reply, a history message, and a message that fails the authenticity check.
- **FR-INTAKE-01-6.** Dev can also act as a source that has "missed" messages: a tester can add messages that Deputy has not yet stored, so catch-up (FRD-03) can be tested.
- **FR-INTAKE-01-7.** Switching the setting from dev to Kapso (or back) does not delete stored messages and does not require a change in any other slice. Stored messages keep the identifier of the provider that produced them.
- **FR-INTAKE-01-11.** With Kapso, Deputy receives by catch-up by default and needs no public address. The owner can switch on live delivery as an advanced setting (FR-INTAKE-03-16). Both settings (catch-up period, live delivery on or off) are read at start.
- **FR-INTAKE-01-9.** The ways to create test messages and forged deliveries (FR-INTAKE-01-3, 01-5, 01-6) exist only while the setting is dev. With Kapso, they are absent and any attempt to use them is refused and noted. Nobody can inject a message into a Kapso setup this way.
- **FR-INTAKE-01-10.** Once the setting is Kapso, stored messages from dev are never counted as pending, never counted in a notice, and never offered a draft. They stay readable and are marked "dev". The Inbox, Notify and Drafts slices rely on this.
- **FR-INTAKE-01-8.** Until Setup has supplied Kapso connection details and the owner's numbers, only dev works. Choosing Kapso without them is refused at start with a message that says what is missing and points to Setup.

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

## Acceptance tests

- Given the setting names a source that is not Kapso or dev, When Deputy starts, Then it refuses to start and lists the two valid values. Tests FR-INTAKE-01-1.
- Given the dev source, When the tester creates a customer message with text "How much is the cake?", Then it is stored with all the fields of FRD-02 and is readable by the Inbox slice. Tests FR-INTAKE-01-3 and FR-INTAKE-01-4.
- Given a dev message and a Kapso message with the same text and chat, When another slice reads them, Then both have the same fields and the same source meaning. Tests FR-INTAKE-01-4.
- Given Kapso is chosen and no connection details exist, When Deputy starts, Then it refuses and says the details are missing. Tests FR-INTAKE-01-8.
- Given stored dev messages, When the owner switches the setting to Kapso, Then the dev messages are still there and are marked as from dev. Tests FR-INTAKE-01-7.
- Given the setting is Kapso, When someone tries to create a test message or a forged delivery, Then it is refused, nothing is stored, and the attempt is noted. Tests FR-INTAKE-01-9.
- Given a stored dev message from a customer nobody answered and the setting is now Kapso, When the owner asks what is pending, Then that chat is not pending and no notice counts it. Tests FR-INTAKE-01-10.

## Open questions

1. Should the owner also be able to delete dev test data in one step? It is hidden from the inbox either way (FR-INTAKE-01-10).

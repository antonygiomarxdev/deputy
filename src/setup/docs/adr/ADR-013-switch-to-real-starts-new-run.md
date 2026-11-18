# ADR-013: Switching from test mode to the real provider starts a new run

## Status
Proposed

## Context
FR-SETUP-04-8: after test mode the owner can switch to the real provider. The profile and catalog stay, steps 2 to 4 run again, and there is a new round trip. The 30-minute measure (FR-SETUP-01-9, FR-SETUP-01-10) is about the real setup. From Setup TP-04, TD-3.

## Decision
`SwitchToReal` creates a new run in mode `real` and marks the test run as superseded, keeping it as history. In one transaction it carries the `install` step and the confirmed profile revision and currency into the new run; steps 2, 3, 4 and 6 start at "to do". The owner or agent can reopen step 5 when the profile mentions test data, which needs a new confirmation. Test messages and chats stay in Intake's history and never count as pending under the real provider (L3).

## Alternatives
- Change the mode in the same run and reset steps: the first-instruction time and the activity of the test run mix with the real run, and the timing is wrong.
- Wipe and start again: loses the profile and catalog the FRD says to keep.

## Consequences
- Easier: the real run has honest timing; the test run stays visible.
- Harder: a carry step in the repository.
- Watch: a profile with test data stays confirmed unless reopened.

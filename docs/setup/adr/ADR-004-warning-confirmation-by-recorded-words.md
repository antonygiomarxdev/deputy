# ADR-004: The sync warning is confirmed by the owner's own words, recorded after it was shown

## Status
Proposed

## Summary

`ShowCosts` records a `warning_shown` fact with the time and returns the full warning.

## Context
R-SETUP-10 and FR-SETUP-02-2: before connecting, the owner must confirm they understood that connecting copies up to 180 days of chat history and contacts to the provider. Silence or an earlier confirmation does not count. Deputy ships no language catalogs (D20), so it cannot read the owner's reply. From Setup TP-02, TD-1.

## Decision
`ShowCosts` records a `warning_shown` fact with the time and returns the full warning. The agent judges the owner's reply in the owner's language and calls `setup_confirm` with the owner's words. `ConfirmSyncWarning` records `warning_confirmed` only when a `warning_shown` fact is earlier, the words are 1 to 500 characters after trimming, and they hold no stored secret. Step 2 passes on such a confirmation with no later `warning_voided` fact. A disconnect followed by a reconnect voids it.

## Options considered
- A fixed typed phrase: English text the owner must type, which breaks D20, and copying it proves nothing.
- A random challenge word the owner types back: an agent can copy it from the text it was given, so it proves nothing about the owner.

## Consequences
- Easier: works in any language; the words are kept for audit like the go.
- Harder: Deputy cannot tell a real confirmation from "ok, whatever"; the setup guide tells the agent to ask again, and an invented confirmation is the accepted limit of D11.
- Watch: owner answers longer than 500 characters are refused as not a confirmation.

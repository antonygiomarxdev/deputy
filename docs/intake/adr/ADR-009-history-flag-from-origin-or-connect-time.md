# ADR-009: A message is history when its origin says so or it was sent before Deputy connected

## Status
Proposed

## Summary

`SyncState.connected_at` is the provider-clock time of the first response of the first run for a provider, saved before anything is stored.

## Context
FR-INTAKE-03-11 and 03-12 flag history and keep it out of signals. FR-INTAKE-04-11 says origin `history_sync` sets the flag, but only `business_app` was seen live (`docs/research/kapso.md`); the other origins are documented, not tested. A first catch-up also holds real messages from the same day. From the Intake TP-03, TD-3.

## Decision
`SyncState.connected_at` is the provider-clock time of the first response of the first run for a provider, saved before anything is stored. A message is history when `sent_at < connected_at`, or when `origin == "history_sync"` and its source is `customer`. For owner and Deputy messages only the time rule decides, so a mislabelled echo sent after connecting is never hidden. The flag is stored with the message and never changes. A message sent after `connected_at` is not history, even in the first run.

## Options considered
- Age against the local clock at the first run: clock skew moves the boundary, so a new message can be flagged history or an old one not.
- Origin only: depends on a value that was not live-tested; one wrong label floods Notify or hides history.

## Consequences
- Easier: the flag is right even if Kapso mislabels origins.
- Harder: `connected_at` must come from the provider's `Date` header, not the local clock.
- History messages are still returned by `ReadChat` with their `sentAt` and `storedAt`; consumers must not treat the flag as proof of age.
- Watch: switching dev to Kapso starts a new `connected_at`, because status rows are per provider.

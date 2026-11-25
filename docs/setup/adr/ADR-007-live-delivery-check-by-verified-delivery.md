# ADR-007: Live delivery passes only on a signature-verified delivery seen by Intake

## Status
Accepted (2026-11-25)

## Summary

After the owner says they sent the provider's test delivery, `CheckLiveDelivery` passes when Intake's last verified live-delivery time is later than the time the live step started.

## Context
FR-SETUP-02-12: the optional live-delivery step passes when the provider's test delivery was received and verified. Until then Deputy keeps checking periodically and Setup still completes. A mismatched secret is the likeliest failure (FRD-03 edge case). From Setup TP-02, TD-4.

## Decision
After the owner says they sent the provider's test delivery, `CheckLiveDelivery` passes when Intake's last verified live-delivery time is later than the time the live step started. Otherwise it fails with `secrets_do_not_match` when Intake lists a `bad_signature` rejection since the start, else `live_delivery_not_seen`. The time of the live step is recorded as a wait of kind `live` and kept out of the total.

## Options considered
- The owner says it works: a claim is not evidence, and a mismatched secret would pass unnoticed.
- Setup runs its own listener: a second listener on one address, and Setup would verify signatures, which belongs to Intake.

## Consequences
- Easier: one signature check in one place; a plain reason for the common failure.
- Harder: needs an Intake addition (a verified-delivery time).
- Watch: a delivery sent before the owner says so is not counted; the reason says to send another.

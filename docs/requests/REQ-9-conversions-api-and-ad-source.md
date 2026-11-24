# REQ-9: Conversions API and ad source (priority zero)

Status: Open
Links: [Send conversion events to Meta and record ad source](https://github.com/antonygiomarxdev/deputy/issues/161)

## Summary

Priority zero. Record which Click-to-WhatsApp ad started each chat, then tell Meta when a chat became a sale. Each event is sent only after the owner's go.

Last change: 2026-11-24, first draft from the owner's words

## Who asked and when
The owner, 2026-11-24, in a Claude Code session.

## What they said
> eso va a entrar antes de todo como prioridad cero también

## The problem behind it
Owners who run ads cannot see which ad brought a customer, and Meta cannot optimize for real customers.

## Evidence
Meta documents a `referral` object with `ctwa_clid` on inbound ad messages. The Kapso schema drops it today. Meta does not de-duplicate events, so Deputy keeps a sent-events table. Sharing events with Meta needs an owner opt-in and a README line. Open: ad account access and consent wording.

## Decision
Open. Waits for the owner.

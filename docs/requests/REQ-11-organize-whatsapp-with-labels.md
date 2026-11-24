# REQ-11: Organize WhatsApp with labels

Status: Open
Links: [Organize chats inside Deputy: local labels, pending flags, ad source](https://github.com/antonygiomarxdev/deputy/issues/162)

## Summary

The owner wants to order chats and mark them: this person has something pending, this person came from that ad.

Last change: 2026-11-24, first draft from the owner's words

## Who asked and when
The owner, 2026-11-24, in a Claude Code session.

## What they said
> el poder ordenar tu WhatsApp y agregarle etiquetas, agregarle, mira, esta persona tiene pendiente algo, mira, esta persona viene de tal anuncio

## The problem behind it
Chats are one flat list. Meta does not support WhatsApp Business app labels on the Cloud API, so they cannot be synced.

## Evidence
Meta documents labels as not supported on the Cloud API after Coexistence. Kapso has free-form metadata tags only. So labels live in Deputy and the owner sees them through the agent. Deputy must not promise labels in the WhatsApp app.

## Decision
Open. Waits for the owner.

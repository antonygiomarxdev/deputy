# REQ-6: Anything possible in WhatsApp is possible here

Status: Open
Links: [Decide which message types ship in v1](https://github.com/antonygiomarxdev/deputy/issues/157), [Keep media metadata on receive](https://github.com/antonygiomarxdev/deputy/issues/155), [Download inbound media with a size cap](https://github.com/antonygiomarxdev/deputy/issues/156)

## Summary

The owner wants every message type a person can use in WhatsApp to be usable through Deputy, receiving and sending. Today only text works both ways.

Last change: 2026-11-24, first draft from the owner's words

## Who asked and when
The owner, 2026-11-24, in a Claude Code session.

## What they said
> La idea es que cualquier cosa que vos puedas hacer desde WhatsApp también lo puedas hacer desde aquí.

## The problem behind it
Deputy stores images, audio, video, documents, stickers, locations and contacts as "[type, not readable]" and drops caption, filename and quote data. It sends text only.

## Evidence
The parity map of 2026-11-24 lists 12 message types (M1 to M12) against the Cloud API, Kapso and Deputy. The Kapso schema keeps only the text body, the type and the transcript. Suggested order: keep metadata (M1), download media (M2), then the rest by owner decision.

## Decision
Open. Waits for the owner.

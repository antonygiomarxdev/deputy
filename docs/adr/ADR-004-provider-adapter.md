# ADR-004: One Provider interface; Kapso and dev; Meta removed

## Status
Proposed

## Context
v1 accepts only Kapso and dev (FR-INTAKE-01-1). Catch-up needs list endpoints, which Kapso's Meta-compatible proxy lacks (`docs/research/kapso.md` Q3). Intake needs the raw `kapso.origin` to tell owner echoes from other messages (FR-INTAKE-04-12). From TP TD-4.

## Decision
`Provider` offers:
- list conversations active since a time;
- list messages of a conversation, paged;
- send text, returning the provider message id or an outcome (sent, failed, unknown), used only by Intake's `SendText`;
- optional live delivery: verify the signature and parse a delivery.

Intake owns the provider connection: the `Provider` outbound port, implemented by the Kapso and dev adapters, and the inbound port `SendText(chat, text, sendId)`, which records the send id and the pending outgoing text, sends, then upserts the provider message id. Echo matching (L2) lives in this slice, and `FindOutgoing(chat, since, text)` resolves unknown outcomes. Drafts' `Sender` outbound port is implemented by an adapter that calls `SendText` (ADR-000). One client therefore paces every request, sends included. Dev adds the test entry points (missed messages, unreadable types, transcripts, forged deliveries) and they exist only while the provider is dev (FR-INTAKE-01-9). `providers/meta.ts` is deleted. `graph.ts` keeps `splitText` and the send helper.

## Alternatives
- A second sender adapter in Drafts: two clients each pace themselves and together break the 100 requests per minute limit, and one adapter would import two slices' outbound ports.
- The Kapso SDK: a dependency, and its normalizer hides the raw `origin` field.
- Only the Meta-compatible proxy: cannot list conversations or messages.

## Consequences
- Easier: a new provider is one file implementing one interface; dev and Kapso look the same to other slices.
- Harder: Deputy owns the Kapso REST client and its pagination and rate-limit code.
- Watch: Kapso API changes; the message list has no time filter, so catch-up reads per conversation until a known message.

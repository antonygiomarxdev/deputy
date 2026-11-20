# ADR-007: A possible gap is detected per listing scope, when an exhausted listing lacks a message Deputy already stored

## Status
Accepted (2026-11-18)

## Context
FR-INTAKE-03-15 says: if the oldest message the provider returns is newer than the newest message Deputy stored, and the provider has nothing older, messages may be lost. Read globally, a quiet shop gives a false alarm: its newest stored message is old, and a new conversation's whole listing is newer. From the Intake TP-03, TD-1.

## Decision
Each message listing in a run (one conversation, or the outbound listing) records whether it was read to its end (no next cursor) and the oldest sent time it returned. After the run, for every exhausted listing, Deputy asks the repository for a stored message of the same scope (same `conversation_ref`, or an owner or Deputy message for the outbound listing) with a sent time older than that oldest time. If one exists, the provider no longer holds it: status `failed`, reason `possible_gap`, naming the stored time and the oldest returned time. A first import with nothing stored has nothing to compare.

The status is raised only when the coverage mark of that scope, read before this run's sweeps, is null or older than the oldest returned time O. The coverage marks are `markConversations` (one conversation) and `markOutbound` (owner/Deputy), both in `SyncState`. A mark at or after O means Deputy had already read up to O, so messages older than O that the provider no longer returns are provider retention, not a gap, and the same stretch is not reported again on the next run. The sweeps advance the marks, so the probe uses the copies saved before them (SPEC-03, step 2). The returned time is O.

## Alternatives
- Comparing provider message ids (the newest id Deputy stored against the ids the listing returns): rejected. A message the provider deleted would look like a gap, and the id check misses the outage loss: the ids Deputy holds can still appear in the listing around the unread stretch, so no missing id is seen, while the coverage mark shows the stretch Deputy never read.
- The global comparison of FR-INTAKE-03-15 as written: simple, but false alarms on quiet shops and on the first outbound reply ever sent.
- A daily probe of the whole outbound listing: many requests on a busy number, covers one kind of message, and runs too rarely to name a recent gap. (No retention field is documented in `docs/research/kapso.md` to use instead.)

## Consequences
- Easier: no false alarm from a quiet period; the FRD example still raises the status.
- Harder: one repository query per exhausted listing; a conversation not touched in the run is not checked.
- Watch: a message deleted on the provider side looks like loss; the text says "possible".
- Watch: with a null mark (before the first catch-up), rows delivered live and older than a short provider retention can raise one `possible_gap`. Accepted.

# ADR-004: One use per approval, enforced by a revision check

## Status
Accepted (2026-11-18)

## Context
FR-DRAFTS-02-12: marking the approval used and the draft "sending" is one step that cannot be done twice; two simultaneous sends let one through. FR-DRAFTS-02-8: a second send of the same approval is refused. From TP-02 TD-2. Only the owner process writes (cross-cutting TD-2), but two tool calls can interleave inside it.

## Decision
- `Draft` carries a `revision` that rises on every save. `DraftRepository.save` runs `UPDATE ... WHERE number = ? AND revision = ?` and throws `StaleDraft` when no row changes.
- `ApproveDraft` loads the draft, decides, and saves inside one `UnitOfWork`. The loser of two simultaneous calls gets `StaleDraft`, reloads, sees state "sending", and answers "already being sent".
- An approval row is born used (`used_at` is set at insert). Only the states waiting, held, failed and unknown accept an approval. A draft in "sending", "recording", "sent", "recorded", "rejected" or "replaced" refuses.
- The transaction also checks the lease token (cross-cutting TD-2).

## Alternatives
- An in-process mutex per draft number: stops two calls in one process, but not a second writer that slipped past the lease, and it is lost on a crash. The database row is the truth.
- Rely on the database write lock (one immediate transaction, no revision): the rule then lives only in how one adapter opens a transaction, and other adapters must each reproduce it.
- A unique constraint on approvals alone: stops a double insert but not a send after a state change made by another call.

## Consequences
- Easier: the rule is one SQL statement, and the in-memory adapter does the same compare.
- Harder: every use case that changes a draft must handle `StaleDraft`. The MCP adapter shows it as "this draft changed, list drafts again".

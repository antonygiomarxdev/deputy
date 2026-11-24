# ADR-006: What counts as new since the draft

## Status
Accepted (2026-11-18)

## Context
FR-DRAFTS-03-3: Deputy checks whether, since the draft was made, the owner answered from the app or the customer wrote again, using the source Intake recorded. From TP-03 TD-1. Intake stores a provider sent time and a local stored time per message. A late echo can be stored after the draft with a sent time before it. Intake sets the `history` flag from the origin label or an old sent time, and its origin labels are untested. Intake keeps dev and real messages in separate worlds (flag `dev`), and reports the time of an owner echo it cannot tie to a chat as `unattributedStoredAt`.

## Decision
- A message is new for a draft when its `dev` flag equals the draft's, its source is not `sent_through_deputy`, and either its sent time is after `checked_sent_at`, or its stored time is after `checked_stored_at` and it is not flagged history.
- The `history` flag never hides a message sent after the draft. An `owner_app` message flagged history by mistake, sent after the draft, still holds.
- At creation `checked_stored_at` is a clock reading taken before Intake is asked about the chat, and `checked_sent_at` is the sent time of the latest chat message. A late echo stored between the read and the draft therefore still counts.
- The draft stores its world (`dev`) at creation, from Intake's `activeWorldIsDev`. This keeps the check working under the dev provider without Drafts knowing a provider name.
- When Intake's `unattributedStoredAt` (from `CatchUpChat`) is later than `checked_stored_at`, every send holds with reason `unattributed_echo`, in any chat (L2: the safe direction).
- A hold moves each mark to the newest value among the messages the check saw. The owner's next go then covers only what arrives later.
- Source `owner_app` among the new messages gives `owner_answered`; source `customer` gives `customer_wrote`. Several reasons can apply. The reason lists all.

## Alternatives
- Sent time only: an owner reply that catch-up finds late, with an earlier sent time, would be missed and Deputy would answer over the owner (principle 2).
- Stored time only: a message the provider delivered late but sent before the draft would hold drafts after a slow sync, and a normal late customer message would hold too.
- Skip every history message: a mislabeled owner reply would be skipped and Deputy would answer over the owner.
- Never move the marks: the owner's "send as is" would hold again for the same messages, forever.

## Consequences
- Easier: no content guesses; each of two clocks is compared only with itself.
- Harder: a history import with a recent sent time causes a false hold. That is the safe error.
- Needs from Intake: `storedAt`, `history`, `dev` and `source` on each message, `ReadChat({ chat, limit, storedSince })`, `unattributedStoredAt` on the `CatchUpChat` state, and `activeWorldIsDev` on `ChatExists`.

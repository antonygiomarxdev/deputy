# ADR-004: The chat state projection is recomputed in the same transaction that stores messages

## Status
Proposed

## Context
Inbox and Drafts read, per chat, the last customer message and the last answer with its source. Cross-cutting TD-3 says `Chat` is a projection and `MessageStored` events feed it. An event published after commit can be lost by a crash, and an out-of-order message can arrive after a newer one. From the Intake TP-02, TD-2.

## Decision
The `StoreMessages` service, in the transaction that inserts a batch, recomputes the `chats` row of every chat the batch touched from two indexed queries on `messages` (newest customer message, newest owner or Deputy message). A source change (FR-INTAKE-04-13) recomputes the chat in its own transaction. Events go out after commit and carry no state; they are only a hint to Notify.

## Alternatives
- An event handler updates the projection: a crash between commit and publish leaves it stale until something touches the chat again.
- No projection, compute on read: correct and simple, but every inbox read scans messages per chat, and the cross-cutting Information section already names the `chats` table.

## Consequences
- Easier: the projection never disagrees with the messages; out-of-order arrival needs no special case.
- Harder: two small queries per touched chat per batch.
- Watch: a first import touches every chat; one transaction per page keeps each commit small.

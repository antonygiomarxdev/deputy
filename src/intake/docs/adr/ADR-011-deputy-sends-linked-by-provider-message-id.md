# ADR-011: A report is linked to a Deputy send by the provider message id, with a text match only for unknown outcomes

## Status
Proposed

## Context
L2: a message is "sent through Deputy" only when it matches a Deputy send identifier. The provider's way of echoing an API-sent message is unconfirmed (FRD-04 open question 2). The report can arrive before or after Deputy stores the id. From the Intake TP-04, TD-1.

## Decision
- `SendText` writes an `outgoing` row (send id, chat, text, parts) first, sends each part, then in one transaction stores the provider id of that part in `outgoing_parts` and upserts the message with source `sent_through_deputy`.
- If the report of that part was already stored as `owner_app`, the upsert changes its source and writes a `source_changes` row (FR-INTAKE-04-13). If the report comes later, the unique key finds the stored message and nothing changes.
- A message is `sent_through_deputy` only through a row in `outgoing_parts`.
- When the outcome is unknown, `FindOutgoing` looks in the stored owner-number messages of the chat since the send for one message per part with exactly the part text. Exactly one per part links them to the send id. Anything else leaves the send unknown.

## Alternatives
- Match every echo by chat, text and time: a staff member sending the same words would be labelled Deputy.
- A client reference field on the send: Kapso documents none that comes back on an echo.

## Consequences
- Easier: the safe default holds; a wrong label can only hold a send.
- Harder: a send whose id never comes back stays `owner_app` until Drafts resolves it.
- Watch: confirm with a live send which origin the report carries.

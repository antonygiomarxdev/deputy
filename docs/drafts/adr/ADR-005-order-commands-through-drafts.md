# ADR-005: Order commands get their go in Drafts, which then calls Orders

## Status
Accepted (2026-11-18)

## Context
FR-DRAFTS-02-9 and FR-DRAFTS-02-10: an order, and the owner's own command about an order ("mark Juan's order delivered"), count as a go with the same checks as a reply. FR-DRAFTS-04-8: such commands appear in the drafts log with the owner's words. A log write that fails must stop the action (FRD-04 edge cases). From TP-02 TD-3. Drafts already calls Orders (`OrderPreparer`, `OrderRecorder`), so Orders must not call Drafts: that would be a dependency cycle between slices.

## Decision
- The MCP tools that change or delete an order (`change_order`, `delete_order`) map to a Drafts inbound port, `ApproveOrderCommand({ chat, orderRef, command, change?, confirm?, ownerWords })`.
- It runs `OwnerWordsPolicy` (non-empty, not copied from customer or draft text), writes one `order_command` log entry, and only then calls Orders through the Drafts-side outbound port `OrderChanger` (`change`, `delete`). Orders never imports or calls Drafts.
- The log `reason` is built by Drafts from field names only ("changed: status, date_wanted"; "delete"). No value, no name, no address. The agent does not supply it.
- A delete with `confirm` false logs nothing and deletes nothing; Drafts relays Orders' statement of which order would be removed (FR-ORDERS-02-10).
- If Orders refuses after the log entry, Drafts appends a `failed` entry with the reason and returns it. The approval entry stays as an unused go.
- The draft-number check of ADR-003 does not apply (an order, not a draft, is named). The other checks do.
- Order deletion still sends the `OrderDeleted` outbox event of cross-cutting TD-3 to Drafts for the scrub. That event is Orders' only path back.

## Alternatives
- Orders calls a Drafts port before it applies a change: a cycle between the slices, since Drafts calls Orders.
- Orders checks the words itself and publishes an `OrderChanged` outbox event that Drafts logs later: no call into Drafts, but the rules would exist twice, and a change could exist for a while with no log entry.

## Consequences
- Easier: one go policy, a log written before the change, and one-way dependencies (Drafts to Orders).
- Harder: Drafts' tool path carries order-change input it does not interpret. A crash after the log entry and before the change leaves an approval entry with no change; the owner reads it as an unused go.

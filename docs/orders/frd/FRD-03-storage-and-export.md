# FRD-03: Where orders live, and export

Status: Draft

## Summary

The owner chooses where orders are stored: on their own machine (default) or in their own spreadsheet. Behavior is the same in both. Order data goes nowhere else. The owner can export all orders. See the [slice PRD](../PRD.md).

Last change: 2026-11-24, format 4: a Why section, rules and examples, quality criteria and the n/a references added from the existing text; rows gain "shall"; returned to Draft.

## Why

The slice PRD's requirements R-ORDERS-10, R-ORDERS-11, R-ORDERS-12 and R-ORDERS-15: the owner chooses where orders live, order data goes nowhere else, and the owner can export all orders (see the [slice PRD](../PRD.md)).

## Requirements covered

R-ORDERS-10, R-ORDERS-11, R-ORDERS-12, R-ORDERS-15.

## Behavior

| ID | Pattern | Requirement |
|---|---|---|
| FR-ORDERS-03-1 | always | By default Deputy shall keep orders on the owner's machine. |
| FR-ORDERS-03-2 | always | The owner shall be able to choose their own spreadsheet instead. When they choose it, the agent shall tell them the orders will be stored in that spreadsheet and nowhere else outside the machine. Helping the owner pick during first setup belongs to Setup. |
| FR-ORDERS-03-3 | always | Every behavior in FRD-01 and FRD-02 shall be the same with either choice: record, list, filter, change, history, cancel, delete. |
| FR-ORDERS-03-4 | always | Order data shall go to no service other than the owner's own agent and, if chosen, the owner's own spreadsheet. |
| FR-ORDERS-03-5 | WHEN | When the spreadsheet cannot be reached, a record, a change or a delete fails. The agent shall tell the owner. It shall never report success. A list shall say the orders could not be read, and shall never show an old copy as current. |
| FR-ORDERS-03-5a | IF | If one order cannot be read (bad status value, missing field), the list shall show it as unreadable with whatever is known, and shall still show the others. It shall never drop or hide an order. |
| FR-ORDERS-03-5b | WHEN | After the owner changes the storage choice, Deputy shall not move or copy orders. The list shall show orders from the current place only, and a notice shall say how many orders remain in the old place. |
| FR-ORDERS-03-6 | always | The owner shall be able to export all their orders, including the change history. By default the export shall leave cancelled orders out and shall say how many it left out; every other order shall be there with all fields, in a form the owner can read and keep. The cancelled orders stay stored. Owner decision D26: later, an owner setting will let the export include them. |
| FR-ORDERS-03-7 | always | An export that is partial or failed shall be reported as such, never as complete. |

## Rules and examples

The rules are the behavior rows above, one rule per row. The examples are written from each rule's text and from the existing acceptance tests and edge cases of this document. Every rule has a positive example and a negative or boundary example.

| Rule | Text | Covers |
|---|---|---|
| RULE-1 | the default is the owner's machine | FR-ORDERS-03-1 |
| RULE-2 | the owner's spreadsheet is a choice | FR-ORDERS-03-2 |
| RULE-3 | the behavior is the same with either choice | FR-ORDERS-03-3 |
| RULE-4 | order data goes to no other service | FR-ORDERS-03-4 |
| RULE-5 | an unreachable spreadsheet is reported | FR-ORDERS-03-5 |
| RULE-6 | an unreadable order is shown, never dropped | FR-ORDERS-03-5a |
| RULE-7 | a storage change moves nothing | FR-ORDERS-03-5b |
| RULE-8 | export holds all orders but cancelled ones, which are counted | FR-ORDERS-03-6 |
| RULE-9 | a partial or failed export is reported as such | FR-ORDERS-03-7 |

| Example | Rule | Kind | Given | When | Then |
|---|---|---|---|---|---|
| EX-1 | RULE-1 | positive | The default choice | Orders are recorded and listed | No order data goes to any service except the owner's own agent |
| EX-2 | RULE-1 | negative | The default choice | An order is recorded | No order is stored in a spreadsheet |
| EX-3 | RULE-2 | positive | The spreadsheet choice | The owner records an order | It is stored in the spreadsheet and the list shows it |
| EX-4 | RULE-2 | negative | The spreadsheet is full or read-only | The owner records an order | The record fails and the agent tells the owner |
| EX-5 | RULE-3 | positive | The spreadsheet choice | The owner records an order and lists orders | The record and the list behave as with the machine choice |
| EX-6 | RULE-3 | boundary | The machine is offline with the default choice | The owner uses the orders | All behavior works; with the spreadsheet choice, writes fail with a clear message |
| EX-7 | RULE-4 | positive | The spreadsheet choice | The owner records an order | The order goes only to the owner's own spreadsheet, and the list shows it |
| EX-8 | RULE-4 | negative | The spreadsheet choice | An order is recorded | No order data goes to any service other than the owner's spreadsheet |
| EX-9 | RULE-5 | positive | The spreadsheet is unreachable | The owner gives the go for an order | The agent says it was not recorded and the list does not show it |
| EX-10 | RULE-5 | negative | The spreadsheet was renamed, deleted or its columns edited | The agent reads the orders | Deputy tells the agent it cannot read them as expected and writes into no unknown layout |
| EX-11 | RULE-6 | positive | A spreadsheet with one row holding a bad status | The owner lists orders | That row shows as unreadable and the other orders are listed |
| EX-12 | RULE-6 | negative | A spreadsheet with one row holding a bad status | The owner lists orders | No row is dropped or hidden |
| EX-13 | RULE-7 | positive | Three orders on the machine | The owner switches to a spreadsheet | The list shows none of them and a notice says 3 remain in the old place |
| EX-14 | RULE-7 | negative | The owner has switched the storage choice | The list is shown | Deputy has not moved or copied any order |
| EX-15 | RULE-8 | positive | Five orders | The owner asks for an export | The export holds all five with their fields |
| EX-16 | RULE-8 | boundary | Five orders, one of them cancelled | The owner asks for an export | The export holds four and reports one left out |
| EX-17 | RULE-8 | negative | No orders | The owner asks for an export | The agent says there are none |
| EX-18 | RULE-9 | positive | The export fails halfway | The agent reports | It says the export is incomplete |
| EX-19 | RULE-9 | negative | The export failed | The agent reports | It is not reported as complete |

## Decision table

n/a: no rule combines more than two conditions, so no decision table is needed.

## States

n/a: the storage choice has two values and changes only when the owner changes it (FR-ORDERS-03-2, FR-ORDERS-03-5b); the existing text gives no transition table.

## Invariants

n/a: this repository's docs/INVARIANTS.md holds no row that names this FRD's rules yet.

## Quality criteria

| ID | Characteristic (ISO/IEC 25010) | Criterion |
|---|---|---|
| QC-1 | Functional suitability | Every FR-ORDERS-03 row and every EX row is cited by at least one test; `check.ts trace` reports no uncited id. |
| QC-2 | Performance efficiency | n/a: the existing text states no timing target. |
| QC-3 | Compatibility | n/a: the existing text states no platform target beyond the choices of Setup. |
| QC-4 | Interaction capability | n/a: the existing text states no interaction target. |
| QC-5 | Reliability | An export that fails halfway is reported as incomplete (FR-ORDERS-03-7): the test interrupts the export and finds the report says incomplete. |
| QC-6 | Security | Order data goes to no service other than the owner's own agent and the chosen spreadsheet (FR-ORDERS-03-4): the test records and lists orders and finds no other send. |
| QC-7 | Maintainability | n/a: the existing text states no maintainability target beyond the repository rules. |
| QC-8 | Flexibility | n/a: the existing text states no change scenario for this FRD; cancelled-order export is an open question. |
| QC-9 | Safety | An unreachable spreadsheet never shows an old copy as current (FR-ORDERS-03-5): the test makes it unreachable and finds the list says it could not read the orders. |

## Cross-cutting

n/a: docs/CROSS-CUTTING.md has no filled row; the cross-cutting rules live in docs/tp/TP.md, and no CC-n row applies to Orders in it yet.

## Edge cases

- The owner changes the storage choice while orders exist: FR-ORDERS-03-5b.
- A write whose outcome is unknown: FR-ORDERS-01-16.
- The spreadsheet has been renamed, deleted or its columns edited by the owner: Deputy tells the agent it cannot read the orders as expected. It does not write into an unknown layout.
- The spreadsheet is full or read-only: record fails and the agent tells the owner.
- No orders to export: the agent says there are none.
- A customer message asks for the orders list: nothing is shown. Only the owner's own words in their conversation count.
- The machine is offline with the default choice: all behavior works. With the spreadsheet choice, writes fail with a clear message.

## Information

- Storage choice: machine or the owner's spreadsheet (which one).
- Orders and change history (as in FRD-01 and FRD-02).
- Export: every order that is not cancelled, all fields, history, time of export, and the number of cancelled orders left out.

## Open questions

- Q-1 (Owner: only the owner decides whether the switch copies orders): should Deputy offer to copy orders when the owner switches? This FRD only warns.
- Q-2 (Lead): the export form is for the technical proposal (TP). Confirm that the TP will state it.
- Q-3 (Owner: only the owner decides the v1 export scope): later, not in v1: an owner setting to include cancelled orders in the export (decision D26).

## Acceptance criteria

Generated from the examples above, one per EX row:

- AC-1: Given the default choice, When orders are recorded and listed, Then no order data goes to any service except the owner's own agent. (EX-1)
- AC-2: Given the default choice, When an order is recorded, Then no order is stored in a spreadsheet. (EX-2)
- AC-3: Given the spreadsheet choice, When the owner records an order, Then it is stored in the spreadsheet and the list shows it. (EX-3)
- AC-4: Given the spreadsheet is full or read-only, When the owner records an order, Then the record fails and the agent tells the owner. (EX-4)
- AC-5: Given the spreadsheet choice, When the owner records an order and lists orders, Then the record and the list behave as with the machine choice. (EX-5)
- AC-6: Given the machine is offline with the default choice, When the owner uses the orders, Then all behavior works; with the spreadsheet choice, writes fail with a clear message. (EX-6)
- AC-7: Given the spreadsheet choice, When the owner records an order, Then the order goes only to the owner's own spreadsheet, and the list shows it. (EX-7)
- AC-8: Given the spreadsheet choice, When an order is recorded, Then no order data goes to any service other than the owner's spreadsheet. (EX-8)
- AC-9: Given the spreadsheet is unreachable, When the owner gives the go for an order, Then the agent says it was not recorded and the list does not show it. (EX-9)
- AC-10: Given the spreadsheet was renamed, deleted or its columns edited, When the agent reads the orders, Then deputy tells the agent it cannot read them as expected and writes into no unknown layout. (EX-10)
- AC-11: Given a spreadsheet with one row holding a bad status, When the owner lists orders, Then that row shows as unreadable and the other orders are listed. (EX-11)
- AC-12: Given a spreadsheet with one row holding a bad status, When the owner lists orders, Then no row is dropped or hidden. (EX-12)
- AC-13: Given three orders on the machine, When the owner switches to a spreadsheet, Then the list shows none of them and a notice says 3 remain in the old place. (EX-13)
- AC-14: Given the owner has switched the storage choice, When the list is shown, Then deputy has not moved or copied any order. (EX-14)
- AC-15: Given five orders, When the owner asks for an export, Then the export holds all five with their fields. (EX-15)
- AC-16: Given five orders, one of them cancelled, When the owner asks for an export, Then the export holds four and reports one left out. (EX-16)
- AC-17: Given no orders, When the owner asks for an export, Then the agent says there are none. (EX-17)
- AC-18: Given the export fails halfway, When the agent reports, Then it says the export is incomplete. (EX-18)
- AC-19: Given the export failed, When the agent reports, Then it is not reported as complete. (EX-19)

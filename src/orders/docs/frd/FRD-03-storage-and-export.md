# FRD-03: Where orders live, and export

Status: Approved (2026-11-18)

## Summary

The owner chooses where orders are stored: on their own machine (default) or in their own spreadsheet. Behavior is the same in both. Order data goes nowhere else. The owner can export all orders. See the [slice PRD](../PRD.md).

## Requirements covered

R-ORDERS-10, R-ORDERS-11, R-ORDERS-12, R-ORDERS-15.

## Behavior

- **FR-ORDERS-03-1.** By default Deputy keeps orders on the owner's machine.
- **FR-ORDERS-03-2.** The owner can choose their own spreadsheet instead. When they choose it, the agent tells them the orders will be stored in that spreadsheet and nowhere else outside the machine. Helping the owner pick during first setup belongs to Setup.
- **FR-ORDERS-03-3.** Every behavior in FRD-01 and FRD-02 is the same with either choice: record, list, filter, change, history, cancel, delete.
- **FR-ORDERS-03-4.** Order data goes to no service other than the owner's own agent and, if chosen, the owner's own spreadsheet.
- **FR-ORDERS-03-5.** When the spreadsheet cannot be reached, a record, a change or a delete fails. The agent tells the owner. It never reports success. A list says the orders could not be read, and never shows an old copy as current.
- **FR-ORDERS-03-5a.** If one order cannot be read (bad status value, missing field), the list shows it as unreadable with whatever is known, and still shows the others. It never drops or hides an order.
- **FR-ORDERS-03-5b.** After the owner changes the storage choice, Deputy does not move or copy orders. The list shows orders from the current place only, and a notice says how many orders remain in the old place.
- **FR-ORDERS-03-6.** The owner can export all their orders, including the change history. By default the export leaves cancelled orders out and says how many it left out; every other order is there with all fields, in a form the owner can read and keep. The cancelled orders stay stored. Owner decision D26: later, an owner setting will let the export include them.
- **FR-ORDERS-03-7.** An export that is partial or failed is reported as such, never as complete.

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

## Acceptance tests

- Given the default choice, When orders are recorded and listed, Then no order data goes to any service except the owner's own agent. (FR-ORDERS-03-1, FR-ORDERS-03-4)
- Given the spreadsheet choice, When the owner records an order, Then it is stored in the spreadsheet and the list shows it. (FR-ORDERS-03-2, FR-ORDERS-03-3)
- Given the spreadsheet is unreachable, When the owner gives the go for an order, Then the agent says it was not recorded and the list does not show it. (FR-ORDERS-03-5)
- Given the spreadsheet is unreachable, When the owner lists orders, Then the agent says it could not read them. (FR-ORDERS-03-5)
- Given five orders, When the owner asks for an export, Then the export holds all five with their fields. Given five orders of which one is cancelled, Then the export holds four and reports one left out. (FR-ORDERS-03-6)
- Given the export fails halfway, When the agent reports, Then it says the export is incomplete. (FR-ORDERS-03-7)

- Given a spreadsheet with one row holding a bad status, When the owner lists orders, Then that row shows as unreadable and the other orders are listed. (FR-ORDERS-03-5a)
- Given three orders on the machine, When the owner switches to a spreadsheet, Then the list shows none of them and a notice says 3 remain in the old place. (FR-ORDERS-03-5b)

## Open questions

- Should Deputy offer to copy orders when the owner switches? This FRD only warns.
- In what form should the export be? This is for the TP.
- Later, not in v1: an owner setting to include cancelled orders in the export (decision D26).

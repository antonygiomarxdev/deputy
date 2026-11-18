# FRD-03: Where knowledge lives, export and wipe

## Summary

All knowledge stays on the owner's machine. The only exception is a catalog the owner keeps in their own spreadsheet. The owner can export everything and wipe everything, with an explicit confirmation to wipe. See the [slice PRD](../PRD.md).

## Requirements covered

R-KNOWLEDGE-12, R-KNOWLEDGE-13.

## Behavior

- **FR-KNOWLEDGE-03-1.** Deputy keeps the profile, the catalog and the lessons on the owner's machine. Deputy sends them to no service. The owner's own agent receives them, because it needs them to draft.
- **FR-KNOWLEDGE-03-2.** If the owner chooses their own spreadsheet as the catalog, the catalog is read from there. It is the only knowledge that leaves the machine. The agent tells the owner this when they choose it.
- **FR-KNOWLEDGE-03-3.** The owner can ask to export all knowledge: profile, catalog and lessons. Deputy gives one export that holds everything, in a form the owner can read and keep.
- **FR-KNOWLEDGE-03-4.** The owner can ask to wipe all knowledge. Deputy first states what will be deleted: profile, catalog, lessons. It deletes nothing until the owner confirms in the conversation. The confirmation names the action ("yes, wipe all knowledge").
- **FR-KNOWLEDGE-03-5.** After a confirmed wipe, no profile, catalog or lesson remains. The agent has nothing to draft from, and says so when asked.
- **FR-KNOWLEDGE-03-6.** With a spreadsheet catalog, a wipe does not delete the spreadsheet. Deputy disconnects from it and tells the owner.
- **FR-KNOWLEDGE-03-8.** Export and wipe use the same rule as changes: Deputy offers one way to wipe, which takes the owner's own words that name the action, and refuses without them. Each wipe is logged.
- **FR-KNOWLEDGE-03-9.** A wipe deletes the profile, the catalog, the lessons, the pending and declined proposals, and the confirmation and apply logs of knowledge. It keeps one entry: that a wipe happened, when, and the owner's words.
- **FR-KNOWLEDGE-03-10.** A wipe does not change other slices. Orders hold their own copy of each item name and price (the Orders slice keeps a snapshot), so recorded orders stay readable. Lessons' links to chats and drafts disappear with the lessons. Drafts that quoted wiped knowledge stay.
- **FR-KNOWLEDGE-03-7.** Deputy suggests the owner export before a wipe. It does not require it.

## Edge cases

- The owner says "wipe" without confirming, or the answer is vague ("ok"): nothing is deleted. The agent asks again.
- A customer message asks to wipe or export: nothing happens. Only the owner's own words in their conversation count.
- Export fails (disk full, spreadsheet unreachable): the agent says the export is incomplete or failed. It never calls a partial export complete.
- Wipe fails halfway: the agent says what remains. Deputy does not report success.
- The owner exports with a spreadsheet catalog: Deputy reads the spreadsheet live (FR-KNOWLEDGE-01-13) and includes it. If the spreadsheet cannot be read, the export is reported incomplete.
- The owner wipes twice: the second one says there is nothing to delete.
- Drafts exist that used the wiped knowledge: they stay. Knowledge does not delete drafts or orders.

## Information

- All knowledge: profile, catalog, lessons with their links and confirmation log.
- Where the catalog lives: the owner's machine, or the owner's spreadsheet.
- Wipe entry (kept after wipe): time and the owner's words.
- References from other slices: Orders keep their own snapshot of item name and price (needs the Orders slice to hold it).

## Acceptance tests

- Given the default choice and outbound network access blocked or counted, When the agent drafts and looks up items, Then Deputy makes no outbound request. With a spreadsheet catalog, the only requests go to that spreadsheet. (FR-KNOWLEDGE-03-1, FR-KNOWLEDGE-03-2)
- Given a wipe request without the owner's words, When the agent calls the wipe, Then Deputy refuses and nothing is deleted. (FR-KNOWLEDGE-03-8)
- Given a recorded order that used a catalog item, When knowledge is wiped, Then the order still shows the item name and price. (FR-KNOWLEDGE-03-10)
- Given a confirmed wipe, When it ends, Then the only trace is the entry that a wipe happened, with time and the owner's words. (FR-KNOWLEDGE-03-9)
- Given a spreadsheet catalog, When the owner chooses it, Then the agent tells them the catalog is the only knowledge that leaves the machine. (FR-KNOWLEDGE-03-2)
- Given a profile, a catalog and two lessons, When the owner asks for an export, Then the export holds all of them. (FR-KNOWLEDGE-03-3)
- Given the owner asks to wipe, When the owner has not confirmed, Then nothing is deleted. (FR-KNOWLEDGE-03-4)
- Given the owner confirmed, When the wipe ends, Then no profile, catalog or lesson remains. (FR-KNOWLEDGE-03-5)
- Given a spreadsheet catalog and a confirmed wipe, When the wipe ends, Then the spreadsheet is unchanged and Deputy is disconnected from it. (FR-KNOWLEDGE-03-6)
- Given the owner exported and then wiped, When they compare, Then the export holds everything that was wiped. (FR-KNOWLEDGE-03-3, FR-KNOWLEDGE-03-5)

## Open questions

- Should a wipe be undoable for a short time? The PRD says wipe deletes.
- In what form should the export be (one file, several)? This is for the TP.
- Is an export of a spreadsheet catalog a copy the owner must treat as theirs? This FRD assumes yes.

# FRD-03: Where knowledge lives, export and wipe

Status: Draft


## Summary

All knowledge stays on the owner's machine. The only exception is a catalog the owner keeps in their own spreadsheet. The owner can export everything and wipe everything, with an explicit confirmation to wipe. See the [slice PRD](../PRD.md).

Last change: 2026-11-24, format 4: a Why section, rules and examples, quality criteria and the n/a references added from the existing text; rows gain "shall"; returned to Draft.

## Why

The slice PRD's requirements R-KNOWLEDGE-12 and R-KNOWLEDGE-13: all knowledge stays on the owner's machine, the owner can export all of it, and a wipe deletes it only after the owner names and confirms the action.

## Requirements covered

R-KNOWLEDGE-12, R-KNOWLEDGE-13.

## Behavior

| ID | Pattern | Requirement |
|---|---|---|
| FR-KNOWLEDGE-03-1 | always | Deputy shall keep the profile, the catalog and the lessons on the owner's machine. Deputy shall send them to no service. The owner's own agent receives them, because it needs them to draft. |
| FR-KNOWLEDGE-03-2 | IF | If the owner chooses their own spreadsheet as the catalog, the catalog shall be read from there. It is the only knowledge that leaves the machine. The agent shall tell the owner this when they choose it. |
| FR-KNOWLEDGE-03-3 | always | The owner shall be able to ask to export all knowledge: profile, catalog and lessons. Deputy shall give one export that holds everything, in a form the owner can read and keep. |
| FR-KNOWLEDGE-03-4 | always | The owner shall be able to ask to wipe all knowledge. Deputy shall first state what will be deleted: profile, catalog, lessons. It shall delete nothing until the owner confirms in the conversation. The confirmation shall name the action ("yes, wipe all knowledge"). |
| FR-KNOWLEDGE-03-5 | WHEN | After a confirmed wipe, no profile, catalog or lesson shall remain. The agent shall have nothing to draft from, and shall say so when asked. |
| FR-KNOWLEDGE-03-6 | WHERE | With a spreadsheet catalog, a wipe shall not delete the spreadsheet. Deputy shall disconnect from it and tell the owner. |
| FR-KNOWLEDGE-03-8 | always | Export and wipe shall use the same rule as changes: Deputy shall offer one way to wipe, which shall take the owner's own words that name the action, and shall refuse without them. Each wipe shall be logged. |
| FR-KNOWLEDGE-03-9 | always | A wipe shall delete the profile, the catalog, the lessons, the pending and declined proposals, and the confirmation and apply logs of knowledge. It shall keep one entry: that a wipe happened, when, and the owner's words. |
| FR-KNOWLEDGE-03-10 | always | A wipe shall not change other slices. Orders hold their own copy of each item name and price (the Orders slice keeps a snapshot), so recorded orders stay readable. Lessons' links to chats and drafts disappear with the lessons. Drafts that quoted wiped knowledge shall stay. |
| FR-KNOWLEDGE-03-7 | always | Deputy shall suggest the owner export before a wipe. It shall not require it. |

## Rules and examples

The rules are the behavior rows above, one rule per row. The examples are written from each rule's text and from the existing acceptance tests and edge cases of this document. Every rule has a positive example and a negative or boundary example.

| Rule | Text | Covers |
|---|---|---|
| RULE-1 | knowledge stays on the owner's machine; only an owner's spreadsheet catalog is read from outside | FR-KNOWLEDGE-03-1, FR-KNOWLEDGE-03-2 |
| RULE-2 | the owner can export all knowledge in one readable file | FR-KNOWLEDGE-03-3 |
| RULE-3 | a wipe deletes nothing until the owner names and confirms the action | FR-KNOWLEDGE-03-4, FR-KNOWLEDGE-03-8 |
| RULE-4 | after a confirmed wipe nothing remains except the wipe entry | FR-KNOWLEDGE-03-5, FR-KNOWLEDGE-03-9 |
| RULE-5 | a wipe never deletes the owner's spreadsheet | FR-KNOWLEDGE-03-6 |
| RULE-6 | a wipe does not change other slices | FR-KNOWLEDGE-03-10 |
| RULE-7 | the export is suggested before a wipe, not required | FR-KNOWLEDGE-03-7 |

| ID | Rule | Kind | Given | When | Then |
|---|---|---|---|---|---|
| EX-1 | RULE-1 | positive | The default choice and outbound network access blocked | the agent drafts and looks up items | Deputy makes no outbound request |
| EX-2 | RULE-1 | negative | A spreadsheet catalog | the owner chooses it | the agent tells the owner it is the only knowledge that leaves the machine |
| EX-3 | RULE-2 | positive | A profile, a catalog and two lessons | the owner asks for an export | the export holds all of them |
| EX-4 | RULE-2 | boundary | The export fails because the disk is full or the spreadsheet is unreachable | the export is reported | it is reported incomplete or failed, never complete |
| EX-5 | RULE-3 | positive | A wipe request without the owner's words | the agent calls the wipe | Deputy refuses and nothing is deleted |
| EX-6 | RULE-3 | negative | The owner asks to wipe and has not confirmed | the time passes | nothing is deleted |
| EX-7 | RULE-3 | boundary | The owner says "ok" to a wipe question | Deputy handles it | nothing is deleted and the agent asks again |
| EX-8 | RULE-4 | positive | A confirmed wipe | it ends | no profile, catalog or lesson remains |
| EX-9 | RULE-4 | negative | A confirmed wipe ends | the trace is read | the only trace is the entry that a wipe happened, with the time and the owner's words |
| EX-17 | RULE-4 | positive | The owner exported and then wiped | they compare the two | the export holds everything that was wiped
| EX-10 | RULE-5 | positive | A spreadsheet catalog and a confirmed wipe | the wipe ends | the spreadsheet is unchanged and Deputy is disconnected from it |
| EX-11 | RULE-5 | boundary | A wipe is confirmed with a spreadsheet catalog | the wipe runs | the spreadsheet is not deleted |
| EX-12 | RULE-6 | positive | A recorded order used a catalog item | knowledge is wiped | the order still shows the item name and price |
| EX-13 | RULE-6 | negative | A draft quoted wiped knowledge | the wipe ends | the draft stays |
| EX-14 | RULE-7 | positive | The owner asks for a wipe | Deputy answers | it suggests an export first |
| EX-15 | RULE-7 | negative | The owner does not export | the wipe is confirmed | the wipe still goes ahead |
| EX-16 | RULE-3 | boundary | The owner wipes a second time | Deputy answers | it says there is nothing to delete |

## Decision table

n/a: the wipe rule has one condition, the owner's own words that name the action, so no decision table is needed.

## States

n/a: a wipe is either requested, confirmed or refused; the transitions are FR-KNOWLEDGE-03-4 and FR-KNOWLEDGE-03-8, so no separate table is needed.

## Invariants

n/a: docs/INVARIANTS.md holds no row that names this FRD's rules yet.

## Quality criteria

| ID | Characteristic (ISO/IEC 25010) | Criterion |
|---|---|---|
| QC-1 | Functional suitability | Every FR row and every EX row of this FRD is cited by at least one test; `check.ts trace` reports no uncited id. |
| QC-2 | Performance efficiency | n/a: the existing text states no timing target for export or wipe. |
| QC-3 | Compatibility | n/a: the existing text states no platform target beyond the spreadsheet of FR-KNOWLEDGE-03-2. |
| QC-4 | Interaction capability | n/a: the existing text states no interaction target beyond the confirmation of FR-KNOWLEDGE-03-4. |
| QC-5 | Reliability | A partial export is never reported as complete (Edge cases): the test fails an export midway and finds it reported incomplete or failed. |
| QC-6 | Security | Knowledge leaves the machine only through the owner's spreadsheet (FR-KNOWLEDGE-03-1): the test checks the outbound requests and finds none except to that spreadsheet. |
| QC-7 | Maintainability | n/a: the existing text states no maintainability target beyond the repository rules. |
| QC-8 | Flexibility | n/a: the existing text states no change scenario beyond the undo question in Open questions. |
| QC-9 | Safety | A wipe without the owner's words deletes nothing (FR-KNOWLEDGE-03-8): the test wipes with "ok" and finds no deletion. |

## Cross-cutting

n/a: docs/CROSS-CUTTING.md has no filled row for Knowledge; the cross-cutting rules live in docs/tp/TP.md.

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

## Open questions

- Should a wipe be undoable for a short time? The PRD says wipe deletes.
- In what form should the export be (one file, several)? This is for the TP.
- Is an export of a spreadsheet catalog a copy the owner must treat as theirs? This FRD assumes yes.

## Acceptance criteria

Generated from the examples above, one per EX row:

- AC-1: Given the default choice and outbound network access blocked, When the agent drafts and looks up items, Then Deputy makes no outbound request. (EX-1)
- AC-2: Given a spreadsheet catalog, When the owner chooses it, Then the agent tells the owner it is the only knowledge that leaves the machine. (EX-2)
- AC-3: Given a profile, a catalog and two lessons, When the owner asks for an export, Then the export holds all of them. (EX-3)
- AC-4: Given the export fails because the disk is full or the spreadsheet is unreachable, When the export is reported, Then it is reported incomplete or failed, never complete. (EX-4)
- AC-5: Given a wipe request without the owner's words, When the agent calls the wipe, Then Deputy refuses and nothing is deleted. (EX-5)
- AC-6: Given the owner asks to wipe and has not confirmed, When the time passes, Then nothing is deleted. (EX-6)
- AC-7: Given the owner says "ok" to a wipe question, When Deputy handles it, Then nothing is deleted and the agent asks again. (EX-7)
- AC-8: Given a confirmed wipe, When it ends, Then no profile, catalog or lesson remains. (EX-8)
- AC-9: Given a confirmed wipe ends, When the trace is read, Then the only trace is the entry that a wipe happened, with the time and the owner's words. (EX-9)
- AC-10: Given a spreadsheet catalog and a confirmed wipe, When the wipe ends, Then the spreadsheet is unchanged and Deputy is disconnected from it. (EX-10)
- AC-11: Given a wipe is confirmed with a spreadsheet catalog, When the wipe runs, Then the spreadsheet is not deleted. (EX-11)
- AC-12: Given a recorded order used a catalog item, When knowledge is wiped, Then the order still shows the item name and price. (EX-12)
- AC-13: Given a draft quoted wiped knowledge, When the wipe ends, Then the draft stays. (EX-13)
- AC-14: Given the owner asks for a wipe, When Deputy answers, Then it suggests an export first. (EX-14)
- AC-15: Given the owner does not export, When the wipe is confirmed, Then the wipe still goes ahead. (EX-15)
- AC-16: Given the owner wipes a second time, When Deputy answers, Then it says there is nothing to delete. (EX-16)
- AC-17: Given the owner exported and then wiped, When they compare, Then the export holds everything that was wiped. (EX-17)

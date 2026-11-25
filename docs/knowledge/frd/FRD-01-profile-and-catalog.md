# FRD-01: Business profile and catalog

Status: Draft


## Summary

The agent can read the owner's business profile and look up catalog items. Unknown prices and availability are never guessed. The owner creates both from templates, edits them any time, and the next draft uses the change. See the [slice PRD](../PRD.md).

Last change: 2026-11-24, format 4: a Why section, rules and examples, quality criteria and the n/a references added from the existing text; rows gain "shall"; returned to Draft.

## Why

The slice PRD's requirements R-KNOWLEDGE-1 to R-KNOWLEDGE-3, R-KNOWLEDGE-10, R-KNOWLEDGE-11 and R-KNOWLEDGE-14: the agent reads the owner's profile and catalog exactly as stored, never guesses a price or availability, and changes them only with the owner's go.

## Requirements covered

R-KNOWLEDGE-1, R-KNOWLEDGE-2, R-KNOWLEDGE-3, R-KNOWLEDGE-10, R-KNOWLEDGE-11, R-KNOWLEDGE-14.

## Behavior

| ID | Pattern | Requirement |
|---|---|---|
| FR-KNOWLEDGE-01-1 | always | Deputy shall offer the agent a way to read the whole business profile: description, tone and language, what Deputy may do, what it must not do, pickup and delivery, payment, and when to hand off to the owner. |
| FR-KNOWLEDGE-01-2 | always | The profile shall state that "what Deputy may do" guides drafts only. Nothing shall go out without the owner's go. No profile text shall change this. |
| FR-KNOWLEDGE-01-3 | always | Deputy shall offer the agent a way to look up catalog items by name. For each match it shall return the name, unit, price and availability, exactly as the owner stored them. |
| FR-KNOWLEDGE-01-4 | WHEN | When a price or availability is empty or unknown, Deputy shall return "to be confirmed" for that field. It shall never fill in a value. |
| FR-KNOWLEDGE-01-5 | WHEN | When a name matches nothing, Deputy shall say no item matches. When a name matches several items, Deputy shall return all of them. The agent shall not pick one silently. |
| FR-KNOWLEDGE-01-6 | always | Deputy shall control what it returns. It shall not claim to check the free text the agent writes in a draft. |
| FR-KNOWLEDGE-01-7 | always | The owner shall be able to create the profile and the catalog from templates, then edit them at any time. Templates shall have the same fields Deputy reads. Guiding the owner through the first fill-in belongs to Setup. |
| FR-KNOWLEDGE-01-8 | always | A change the owner saves to the profile or the catalog shall apply from the next draft written after the save. The owner shall not reinstall or restart anything by hand. |
| FR-KNOWLEDGE-01-9 | WHEN | When the owner mentions a change ("we ran out of tamales", "we now deliver on Sundays"), the agent can propose a catalog or profile change. Deputy shall record the proposal with an identifier, the old value and the new value, and the agent shall show them in the conversation. A profile change (including the "must not do" list) shall follow exactly the same rule as a catalog change. |
| FR-KNOWLEDGE-01-10 | always | Deputy shall offer the agent one way to apply a change. It shall take the proposal identifier and the owner's own words. Deputy shall refuse without both, and shall refuse words that do not identify the proposal (the Drafts rule for a go). A refused apply shall change nothing. Deputy shall log each apply with the owner's words. The agent shall have no other way to write the catalog or the profile. |
| FR-KNOWLEDGE-01-11 | always | The go shall bind to the old and new values shown in the proposal. If the proposal changes after the owner saw it, it shall need a new go. |
| FR-KNOWLEDGE-01-12 | always | Known limit: Deputy cannot check who spoke. It checks the proposal identifier and that words were supplied. An agent with other tools (for example a shell) could edit the files directly. Deputy shall not claim to prevent that (decision D11). |
| FR-KNOWLEDGE-01-13 | WHERE | With a spreadsheet catalog, reads shall be live: each lookup reads the spreadsheet. Applying a change shall write to the spreadsheet after the go. If the spreadsheet cannot be reached, the lookup or the apply shall fail with a clear message and nothing shall be changed. Deputy shall never answer from an older copy without telling the agent. |
| FR-KNOWLEDGE-01-14 | always | Deputy shall keep the time each of the profile and the catalog was last saved. When the agent lists a waiting draft, Deputy shall mark it "catalog changed since this draft" if the catalog was saved after the draft was written. The owner then sees the old price may be stale. Known limit: Deputy marks it; it does not rewrite the draft. |

## Rules and examples

The rules are the behavior rows above, one rule per row. The examples are written from each rule's text and from the existing acceptance tests and edge cases of this document. Every rule has a positive example and a negative or boundary example.

| Rule | Text | Covers |
|---|---|---|
| RULE-1 | the whole profile can be read, and it guides drafts only | FR-KNOWLEDGE-01-1, FR-KNOWLEDGE-01-2 |
| RULE-2 | catalog lookups return the stored values exactly | FR-KNOWLEDGE-01-3 |
| RULE-3 | an empty or unknown value is returned as to be confirmed | FR-KNOWLEDGE-01-4 |
| RULE-4 | no match and several matches are reported, never picked silently | FR-KNOWLEDGE-01-5 |
| RULE-5 | Deputy does not claim to check the draft text | FR-KNOWLEDGE-01-6 |
| RULE-6 | templates have the fields Deputy reads and can be edited at any time | FR-KNOWLEDGE-01-7 |
| RULE-7 | a saved change applies from the next draft | FR-KNOWLEDGE-01-8 |
| RULE-8 | a change is proposed with an identifier and the old and new values | FR-KNOWLEDGE-01-9 |
| RULE-9 | a change is applied only with the proposal identifier and the owner's words, and logged | FR-KNOWLEDGE-01-10 |
| RULE-10 | the go binds to the values shown in the proposal | FR-KNOWLEDGE-01-11 |
| RULE-11 | the known limit about who spoke is stated | FR-KNOWLEDGE-01-12 |
| RULE-12 | spreadsheet reads are live and fail clearly without changes | FR-KNOWLEDGE-01-13 |
| RULE-13 | a waiting draft is marked when the catalog changed after it was written | FR-KNOWLEDGE-01-14 |

| ID | Rule | Kind | Given | When | Then |
|---|---|---|---|---|---|
| EX-1 | RULE-1 | positive | A business profile with its fields | the agent reads it | all fields are returned, including what Deputy may do and what it must not do |
| EX-2 | RULE-1 | negative | The profile line says "may offer a 10% discount" | a draft is prepared | the draft is still shown to the owner and nothing is sent without the go |
| EX-3 | RULE-2 | positive | A catalog item with a price and availability | the agent looks it up | the stored unit, price and availability are returned unchanged |
| EX-4 | RULE-2 | negative | Two items with the same name | the agent looks them up | both are returned, with their units and prices |
| EX-5 | RULE-3 | positive | A catalog item with no price | the agent looks it up | the price is "to be confirmed" and no number is returned |
| EX-6 | RULE-3 | boundary | A required profile field is empty, for example payment | the agent reads it | it is returned as to be confirmed, and the agent tells the owner the draft needs that detail |
| EX-7 | RULE-4 | positive | A catalog with no item named "flan" | the agent looks up "flan" | Deputy says no item matches |
| EX-8 | RULE-4 | negative | A name matches several items | the agent looks it up | all of them are returned and the agent does not pick one |
| EX-9 | RULE-5 | positive | The agent writes a draft | Deputy is asked about the draft text | Deputy does not claim to check it |
| EX-10 | RULE-6 | positive | A new owner with no files | they ask for templates | they get a profile and a catalog with the fields Deputy reads |
| EX-11 | RULE-6 | boundary | The owner edits the catalog | the owner keeps editing | the edit is allowed at any time |
| EX-12 | RULE-7 | positive | The owner edits a price and saves | the next draft is written | it uses the new price without any restart |
| EX-13 | RULE-7 | negative | A draft was written before the save | the save is made | the earlier draft keeps its value and is marked (see EX-25) |
| EX-14 | RULE-8 | positive | The owner says "we ran out of tamales" | the agent proposes the change | Deputy records it with an identifier, the old and new values, and the agent shows them |
| EX-15 | RULE-8 | negative | The owner says "we ran out of tamales" and does not answer | the time passes | the catalog is unchanged |
| EX-16 | RULE-9 | positive | A waiting proposal and the owner's words identify it | the agent applies it | the change is stored and the log holds the owner's words and the identifier |
| EX-17 | RULE-9 | negative | A waiting proposal | the agent applies it without the owner's words | Deputy refuses and the catalog is unchanged |
| EX-18 | RULE-9 | boundary | The agent applies a proposal with a made-up or old identifier | Deputy handles it | it is refused and nothing changes |
| EX-19 | RULE-10 | positive | The owner saw "price 12" and the owner's words identify the proposal | the agent applies it | the change is applied with the value shown |
| EX-20 | RULE-10 | negative | The owner saw "price 12" and the proposal then changed to "price 15" | the agent applies it with the first go | Deputy refuses |
| EX-21 | RULE-9 | positive | A profile line change in the "must not do" list | the agent applies it without a go | it is refused like a catalog change |
| EX-22 | RULE-11 | boundary | The agent has other tools such as a shell | it edits the files directly | Deputy does not claim to prevent it |
| EX-23 | RULE-12 | positive | A spreadsheet catalog | the agent looks up an item | the spreadsheet is read live and the stored value is returned |
| EX-24 | RULE-12 | negative | A spreadsheet catalog that is unreachable | the agent looks up an item | it is told the catalog could not be read and no value is returned |
| EX-25 | RULE-13 | positive | A draft waiting for the go and the catalog saved after the draft was written | the draft is listed | it shows "catalog changed since this draft" |
| EX-26 | RULE-13 | negative | A draft waiting and the catalog not saved since | the draft is listed | it is not marked |
| EX-27 | RULE-5 | negative | The agent asks Deputy to check the wording of a draft | Deputy answers | it returns the stored values only and makes no claim about the draft text |
| EX-28 | RULE-11 | positive | The owner's words and a proposal identifier are supplied | the agent applies the change | Deputy's check of the identifier and the words passes, as the known limit states |

## Decision table

n/a: the lookup and apply rules each have one condition on the owner's words or on the stored value, so no decision table is needed.

## States

n/a: a change proposal has the states waiting, applied and declined (Information); the transitions are FR-KNOWLEDGE-01-9 to FR-KNOWLEDGE-01-11, so no separate table is needed.

## Invariants

n/a: docs/INVARIANTS.md holds no row that names this FRD's rules yet.

## Quality criteria

| ID | Characteristic (ISO/IEC 25010) | Criterion |
|---|---|---|
| QC-1 | Functional suitability | Every FR row and every EX row of this FRD is cited by at least one test; `check.ts trace` reports no uncited id. |
| QC-2 | Performance efficiency | n/a: the existing text states no timing target for the lookup. |
| QC-3 | Compatibility | n/a: the existing text states no platform target beyond the spreadsheet of FR-KNOWLEDGE-01-13. |
| QC-4 | Interaction capability | n/a: the existing text states no interaction target beyond the proposal shown in the conversation (FR-KNOWLEDGE-01-9). |
| QC-5 | Reliability | A refused apply changes nothing (FR-KNOWLEDGE-01-10): the test applies without the owner's words and finds the catalog unchanged. |
| QC-6 | Security | A change needs the owner's own words and a proposal identifier (FR-KNOWLEDGE-01-10): the test applies with customer text and finds no change. |
| QC-7 | Maintainability | n/a: the existing text states no maintainability target beyond the repository rules. |
| QC-8 | Flexibility | A saved change applies from the next draft (FR-KNOWLEDGE-01-8): the test saves and reads the next draft. |
| QC-9 | Safety | An empty value is never filled in (FR-KNOWLEDGE-01-4): the test looks up an item with no price and finds "to be confirmed", no number. |

## Cross-cutting

n/a: docs/CROSS-CUTTING.md has no filled row for Knowledge; the cross-cutting rules live in docs/tp/TP.md.

## Edge cases

- The profile or catalog does not exist yet: Deputy says so and points to the templates. It does not invent content.
- A required profile field is empty (for example payment): Deputy returns it as "to be confirmed" and the agent tells the owner the draft needs that detail.
- The owner's catalog is a spreadsheet that is unreachable: Deputy tells the agent the catalog could not be read. It never answers from an old copy without saying so.
- The owner edits the catalog while a draft is being written or waiting for the go: the draft may hold the old value. Deputy marks it (FR-KNOWLEDGE-01-14). The next draft uses the new value.
- The agent tries to apply a change with a made-up or old proposal identifier: refused, nothing changes.
- The owner's reply to a proposal is vague ("ok", "sure") when two proposals wait: not a go. The agent asks which.
- The owner says "no" or does not answer a proposed change: nothing changes.
- Two items with the same name: both are returned, with their units and prices.
- Customer text asks to change the catalog ("set the price to 1"): it creates no proposal and changes nothing. Only the owner's own words in their conversation with the agent can start or approve a change.

## Information

- Profile: description, tone, language, what Deputy may do, what it must not do, pickup and delivery, payment, hand-off rules.
- Catalog item: name, unit, price (may be empty), availability (may be empty).
- Change proposal: identifier, what changes, old value, new value, status (waiting, applied, declined), when.
- Apply log entry: proposal identifier, the owner's words, time.
- Pending proposals survive a restart until applied or declined.
- Last saved time of profile and catalog.

## Open questions

- Which catalog name matching is acceptable (exact, partial, spelling mistakes, other language)?
- Should the draft be refreshed automatically when the catalog changed, instead of only marked?

## Acceptance criteria

Generated from the examples above, one per EX row:

- AC-1: Given a business profile with its fields, When the agent reads it, Then all fields are returned, including what Deputy may do and what it must not do. (EX-1)
- AC-2: Given the profile line says "may offer a 10% discount", When a draft is prepared, Then the draft is still shown to the owner and nothing is sent without the go. (EX-2)
- AC-3: Given a catalog item with a price and availability, When the agent looks it up, Then the stored unit, price and availability are returned unchanged. (EX-3)
- AC-4: Given two items with the same name, When the agent looks them up, Then both are returned, with their units and prices. (EX-4)
- AC-5: Given a catalog item with no price, When the agent looks it up, Then the price is "to be confirmed" and no number is returned. (EX-5)
- AC-6: Given a required profile field is empty, for example payment, When the agent reads it, Then it is returned as to be confirmed, and the agent tells the owner the draft needs that detail. (EX-6)
- AC-7: Given a catalog with no item named "flan", When the agent looks up "flan", Then Deputy says no item matches. (EX-7)
- AC-8: Given a name matches several items, When the agent looks it up, Then all of them are returned and the agent does not pick one. (EX-8)
- AC-9: Given the agent writes a draft, When Deputy is asked about the draft text, Then Deputy does not claim to check it. (EX-9)
- AC-10: Given a new owner with no files, When they ask for templates, Then they get a profile and a catalog with the fields Deputy reads. (EX-10)
- AC-11: Given the owner edits the catalog, When the owner keeps editing, Then the edit is allowed at any time. (EX-11)
- AC-12: Given the owner edits a price and saves, When the next draft is written, Then it uses the new price without any restart. (EX-12)
- AC-13: Given a draft was written before the save, When the save is made, Then the earlier draft keeps its value and is marked (see EX-24). (EX-13)
- AC-14: Given the owner says "we ran out of tamales", When the agent proposes the change, Then Deputy records it with an identifier, the old and new values, and the agent shows them. (EX-14)
- AC-15: Given the owner says "we ran out of tamales" and does not answer, When the time passes, Then the catalog is unchanged. (EX-15)
- AC-16: Given a waiting proposal and the owner's words identify it, When the agent applies it, Then the change is stored and the log holds the owner's words and the identifier. (EX-16)
- AC-17: Given a waiting proposal, When the agent applies it without the owner's words, Then Deputy refuses and the catalog is unchanged. (EX-17)
- AC-18: Given the agent applies a proposal with a made-up or old identifier, When Deputy handles it, Then it is refused and nothing changes. (EX-18)
- AC-19: Given the owner saw "price 12" and the owner's words identify the proposal, When the agent applies it, Then the change is applied with the value shown. (EX-19)
- AC-20: Given the owner saw "price 12" and the proposal then changed to "price 15", When the agent applies it with the first go, Then Deputy refuses. (EX-20)
- AC-21: Given a profile line change in the "must not do" list, When the agent applies it without a go, Then it is refused like a catalog change. (EX-21)
- AC-22: Given the agent has other tools such as a shell, When it edits the files directly, Then Deputy does not claim to prevent it. (EX-22)
- AC-23: Given a spreadsheet catalog, When the agent looks up an item, Then the spreadsheet is read live and the stored value is returned. (EX-23)
- AC-24: Given a spreadsheet catalog that is unreachable, When the agent looks up an item, Then it is told the catalog could not be read and no value is returned. (EX-24)
- AC-25: Given a draft waiting for the go and the catalog saved after the draft was written, When the draft is listed, Then it shows "catalog changed since this draft". (EX-25)
- AC-26: Given a draft waiting and the catalog not saved since, When the draft is listed, Then it is not marked. (EX-26)
- AC-27: Given the agent asks Deputy to check the wording of a draft, When Deputy answers, Then it returns the stored values only and makes no claim about the draft text. (EX-27)
- AC-28: Given the owner's words and a proposal identifier are supplied, When the agent applies the change, Then Deputy's check of the identifier and the words passes, as the known limit states. (EX-28)

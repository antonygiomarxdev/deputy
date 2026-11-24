# FRD-01: Business profile and catalog

Status: Approved (2026-11-18)

## Summary

The agent can read the owner's business profile and look up catalog items. Unknown prices and availability are never guessed. The owner creates both from templates, edits them any time, and the next draft uses the change. See the [slice PRD](../PRD.md).

## Requirements covered

R-KNOWLEDGE-1, R-KNOWLEDGE-2, R-KNOWLEDGE-3, R-KNOWLEDGE-10, R-KNOWLEDGE-11, R-KNOWLEDGE-14.

## Behavior

| ID | Pattern | Requirement |
|---|---|---|
| FR-KNOWLEDGE-01-1 | always | Deputy offers the agent a way to read the whole business profile: description, tone and language, what Deputy may do, what it must not do, pickup and delivery, payment, and when to hand off to the owner. |
| FR-KNOWLEDGE-01-2 | always | The profile states that "what Deputy may do" guides drafts only. Nothing goes out without the owner's go. No profile text changes this. |
| FR-KNOWLEDGE-01-3 | always | Deputy offers the agent a way to look up catalog items by name. For each match it returns the name, unit, price and availability, exactly as the owner stored them. |
| FR-KNOWLEDGE-01-4 | WHEN | When a price or availability is empty or unknown, Deputy returns "to be confirmed" for that field. It never fills in a value. |
| FR-KNOWLEDGE-01-5 | WHEN | When a name matches nothing, Deputy says no item matches. When a name matches several items, Deputy returns all of them. The agent does not pick one silently. |
| FR-KNOWLEDGE-01-6 | always | Deputy controls what it returns. It does not claim to check the free text the agent writes in a draft. |
| FR-KNOWLEDGE-01-7 | always | The owner can create the profile and the catalog from templates, then edit them at any time. Templates have the same fields Deputy reads. Guiding the owner through the first fill-in belongs to Setup. |
| FR-KNOWLEDGE-01-8 | always | A change the owner saves to the profile or the catalog applies from the next draft written after the save. The owner does not reinstall or restart anything by hand. |
| FR-KNOWLEDGE-01-9 | WHEN | When the owner mentions a change ("we ran out of tamales", "we now deliver on Sundays"), the agent can propose a catalog or profile change. Deputy records the proposal with an identifier, the old value and the new value, and the agent shows them in the conversation. A profile change (including the "must not do" list) follows exactly the same rule as a catalog change. |
| FR-KNOWLEDGE-01-10 | always | Deputy offers the agent one way to apply a change. It takes the proposal identifier and the owner's own words. Deputy refuses without both, and refuses words that do not identify the proposal (the Drafts rule for a go). A refused apply changes nothing. Deputy logs each apply with the owner's words. The agent has no other way to write the catalog or the profile. |
| FR-KNOWLEDGE-01-11 | always | The go binds to the old and new values shown in the proposal. If the proposal changes after the owner saw it, it needs a new go. |
| FR-KNOWLEDGE-01-12 | always | Known limit: Deputy cannot check who spoke. It checks the proposal identifier and that words were supplied. An agent with other tools (for example a shell) could edit the files directly. Deputy does not claim to prevent that (decision D11). |
| FR-KNOWLEDGE-01-13 | WHERE | With a spreadsheet catalog, reads are live: each lookup reads the spreadsheet. Applying a change writes to the spreadsheet after the go. If the spreadsheet cannot be reached, the lookup or the apply fails with a clear message and nothing is changed. Deputy never answers from an older copy without telling the agent. |
| FR-KNOWLEDGE-01-14 | always | Deputy keeps the time each of the profile and the catalog was last saved. When the agent lists a waiting draft, Deputy marks it "catalog changed since this draft" if the catalog was saved after the draft was written. The owner then sees the old price may be stale. Known limit: Deputy marks it, it does not rewrite the draft. |

Example:

> Owner: We ran out of tamales.
> Agent: I propose to mark "Tamales (dozen)" as unavailable. Apply it?
> Owner: Yes, mark the tamales unavailable.

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

## Acceptance tests

- Given a catalog item with a price and availability, When the agent looks it up, Then Deputy returns the stored unit, price and availability unchanged. (FR-KNOWLEDGE-01-3)
- Given a catalog item with no price, When the agent looks it up, Then the price is "to be confirmed" and no number is returned. (FR-KNOWLEDGE-01-4)
- Given a catalog with no item named "flan", When the agent looks up "flan", Then Deputy says no item matches. (FR-KNOWLEDGE-01-5)
- Given the owner edits a price and saves, When the next draft is written, Then it uses the new price without any restart. (FR-KNOWLEDGE-01-8)
- Given the owner says "we ran out of tamales", When the agent proposes the change and the owner does not answer, Then the catalog is unchanged. (FR-KNOWLEDGE-01-9)
- Given the agent proposed marking tamales unavailable, When the owner replies "yes, mark the tamales unavailable", Then the catalog shows tamales as unavailable. (FR-KNOWLEDGE-01-9)
- Given a profile line "may offer a 10% discount", When a draft is prepared, Then the draft is still shown to the owner and nothing is sent without the go. (FR-KNOWLEDGE-01-2)
- Given a waiting proposal, When the agent tries to apply it without the owner's words, Then Deputy refuses and the catalog is unchanged. (FR-KNOWLEDGE-01-10)
- Given a waiting proposal, When the owner's words identify it and the agent applies it, Then the change is stored and the log holds the owner's words and the identifier. (FR-KNOWLEDGE-01-10)
- Given a proposal to change a profile "must not do" line, When the agent applies it without a go, Then it is refused like a catalog change. (FR-KNOWLEDGE-01-9, FR-KNOWLEDGE-01-10)
- Given the owner saw "price 12" and the proposal then changed to "price 15", When the agent applies it with the first go, Then Deputy refuses. (FR-KNOWLEDGE-01-11)
- Given a spreadsheet catalog that is unreachable, When the agent looks up an item, Then it is told the catalog could not be read and no value is returned. (FR-KNOWLEDGE-01-13)
- Given a draft waiting for the go, When the catalog is saved after the draft was written, Then listing the draft shows "catalog changed since this draft". (FR-KNOWLEDGE-01-14)
- Given a new owner with no files, When they ask for templates, Then they get a profile and a catalog with the fields Deputy reads. (FR-KNOWLEDGE-01-7)

## Open questions

- Which catalog name matching is acceptable (exact, partial, spelling mistakes, other language)?
- Should the draft be refreshed automatically when the catalog changed, instead of only marked?

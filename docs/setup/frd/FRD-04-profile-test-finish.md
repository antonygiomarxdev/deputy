# FRD-04: Profile, catalog, test and finish

Status: Draft · Slice: Setup · Part of [Setup PRD](../PRD.md)

Deferred (REQ-15, 2026-11-24): the local pilot sets up the business profile through the skill's interview (D33, D38). The document stays as written.

## Summary

Setup helps the owner write a first business profile and catalog, proves everything works with a test message answered by an approved draft, and ends with a summary of what is connected. Test mode does the same with no WhatsApp at all. See [../PRD.md](../PRD.md).


Last change: 2026-11-24, format 4: a Why section, rules and examples, quality criteria and the n/a references added from the existing text; rows gain "shall"; returned to Draft.

## Why

The slice PRD's requirements R-SETUP-16 to R-SETUP-19: the owner's profile and catalog come from the owner's own answers, and a test round trip proves Deputy works before setup completes.

## Requirements covered

R-SETUP-16, R-SETUP-17, R-SETUP-18, R-SETUP-19.

## Behavior


| ID | Pattern | Requirement |
|---|---|---|
| FR-SETUP-04-1 | always | In step 5 the agent shall ask the owner short questions about the business (what it sells, hours, area, payment and delivery rules, tone) and the items for sale (name, price, notes). One question shall be asked at a time. |
| FR-SETUP-04-2 | always | Setup shall show the resulting profile and catalog to the owner and shall ask for confirmation. Setup shall hand them to Knowledge only after the owner confirms. A small catalog shall be accepted. Setup shall say it can be improved later. |
| FR-SETUP-04-3 | always | Step 6 shall ask the owner to send a message to the business number from another phone. An owner without a second phone shall be offered test mode, or to ask someone else to send it. |
| FR-SETUP-04-4 | always | The test message shall appear in the inbox. Then the agent shall draft a reply, the owner shall approve it in the conversation, the provider shall accept the send, and the owner shall state that the reply arrived on the other phone. Setup shall be marked complete only when all of that has happened. Deputy knows only that the provider accepted the send, so arrival is the owner's word. |
| FR-SETUP-04-5 | always | The test reply shall be an ordinary draft: it shall need the owner's approval like every reply. Setup shall not send it itself. |
| FR-SETUP-04-6 | IF | If a part of the round trip fails, Setup shall say which part (message did not arrive, no draft, not approved, provider refused it, owner says it did not arrive) and what to do. Setup shall stay at step 6. |
| FR-SETUP-04-7 | always | Test mode shall need no WhatsApp account and shall skip steps 2, 3 and 4. The round trip shall use the development provider: the owner or the agent simulates a customer message, and the draft and approval shall work as in the real run. Test mode shall be marked "test" in the status and in the final summary. |
| FR-SETUP-04-8 | always | The owner shall be able to switch from test mode to the real provider later. The profile and catalog shall be kept. Test messages and test chats from the development provider shall stay as history. Once the provider is not the development one, they shall never count as pending, never appear in notices and never be offered a draft (Intake FR-INTAKE-01-10). Setup shall run steps 2, 3 and 4 and a new round trip. |
| FR-SETUP-04-9 | WHEN | On completion, Setup shall show: what is connected, which numbers are treated as the owner's, where the owner's data lives, how to ask the agent what is pending, and the total time and provider wait (FRD-01). |
| FR-SETUP-04-10 | always | Setup may offer push notices (Notify) as an optional extra for agents that support it, labeled optional. Setup shall complete without it. |

Example:
> Agent: Please send "Hi, do you have empanadas?" to your business number from another phone. Tell me when you have sent it.

## Rules and examples

The rules are the behavior rows above, one rule per row. The examples are written from each rule's text and from the existing acceptance tests and edge cases of this document. Every rule has a positive example and a negative or boundary example.

| Rule | Text | Covers |
|---|---|---|
| RULE-1 | the profile and catalog reach Knowledge only after the owner confirms them | FR-SETUP-04-1, FR-SETUP-04-2 |
| RULE-2 | step 6 asks for a message from another phone, and an owner without one is offered test mode or someone else | FR-SETUP-04-3 |
| RULE-3 | setup is complete only when the whole round trip has happened | FR-SETUP-04-4 |
| RULE-4 | the test reply needs the owner's approval like every reply | FR-SETUP-04-5 |
| RULE-5 | a failed part of the round trip is named and setup stays at step 6 | FR-SETUP-04-6 |
| RULE-6 | test mode needs no WhatsApp account and is marked test | FR-SETUP-04-7 |
| RULE-7 | switching to the real provider keeps the profile and runs steps 2 to 4 again | FR-SETUP-04-8 |
| RULE-8 | completion shows the summary | FR-SETUP-04-9 |
| RULE-9 | push notices are an optional extra | FR-SETUP-04-10 |

| ID | Rule | Kind | Given | When | Then |
|---|---|---|---|---|---|
| EX-1 | RULE-1 | positive | Step 5 and the owner answers the questions | Setup shows the profile and catalog | it hands them to Knowledge only after the owner confirms |
| EX-2 | RULE-1 | negative | The owner has no catalog yet | Setup accepts the profile | it accepts a profile with an empty or one-item catalog and says so |
| EX-3 | RULE-2 | positive | Step 6 is reached | the agent asks for the test | it asks the owner to send "Hi, do you have empanadas?" to the business number from another phone |
| EX-4 | RULE-2 | boundary | An owner has no second phone | Setup asks for the test | the owner is offered test mode, or to ask someone else to send it |
| EX-5 | RULE-3 | negative | The test message arrived and the draft exists, and the owner has not approved it | Setup is checked | Setup is not complete |
| EX-6 | RULE-3 | negative | The provider accepted the send, and the owner says it did not arrive | Setup is checked | Setup is not complete |
| EX-7 | RULE-4 | positive | The test reply is drafted and the owner has not approved it | Setup handles the reply | Setup does not send it and is not complete |
| EX-8 | RULE-4 | boundary | The owner answers the test chat from the app before approving | Setup handles the answer | it shows that answer and asks for a new approval |
| EX-9 | RULE-5 | positive | The owner approved the reply, and sending failed | Setup reports it | it names the failed part and stays at step 6 |
| EX-10 | RULE-5 | negative | The test message does not arrive | Setup checks | it suggests checks in order and does not pass the step |
| EX-11 | RULE-6 | positive | An owner with no WhatsApp account | they run test mode | Setup completes with the development provider and shows "test" |
| EX-12 | RULE-6 | boundary | Test mode is running | the setup steps run | steps 2, 3 and 4 are skipped |
| EX-13 | RULE-7 | positive | Test mode is complete | the owner switches to the real provider | the profile and catalog remain and steps 2 to 4 run again |
| EX-14 | RULE-7 | negative | Test mode is complete with a test chat | the owner switches to the real provider | the first real inbox does not show the test chat as pending |
| EX-15 | RULE-8 | positive | Setup is complete | the final screen is shown | it lists what is connected, the owner numbers, where data lives, how to ask what is pending, and the total time |
| EX-16 | RULE-8 | boundary | The round trip has not passed | the owner asks for the final summary | no final summary is shown, because the summary is shown on completion |
| EX-17 | RULE-9 | positive | Notify is available for the agent | Setup offers push notices | they are labeled optional |
| EX-18 | RULE-9 | negative | The agent does not support push notices | Setup completes | it completes without them |
| EX-19 | RULE-3 | positive | The owner approved the draft | the reply arrives on the other phone | Setup is marked complete and shows the final summary |

## Decision table

n/a: the rules have no combination of conditions that changes the outcome, so no decision table is needed.

## States

n/a: the round trip is a sequence of parts named in FR-SETUP-04-6, and the steps of the flow are defined in FRD-01, so no transition table is needed here.

## Invariants

n/a: docs/INVARIANTS.md holds no row that names this FRD's rules yet.

## Quality criteria

| ID | Characteristic (ISO/IEC 25010) | Criterion |
|---|---|---|
| QC-1 | Functional suitability | Every FR-SETUP-04 row and every EX row is cited by at least one test; `check.ts trace` reports no uncited id. |
| QC-2 | Performance efficiency | n/a: the existing text states no timing target beyond the provider wait of FRD-01. |
| QC-3 | Compatibility | n/a: the existing text states no platform target for this FRD. |
| QC-4 | Interaction capability | n/a: the existing text states no interaction target beyond one question at a time (FR-SETUP-04-1). |
| QC-5 | Reliability | A reply the owner has not approved is not sent (FR-SETUP-04-5): the test leaves the draft unapproved and finds no send. |
| QC-6 | Security | n/a: secrets are handled in FRD-03, not in this FRD. |
| QC-7 | Maintainability | n/a: the existing text states no maintainability target beyond the repository rules. |
| QC-8 | Flexibility | Switching from test mode to the real provider keeps the profile and catalog (FR-SETUP-04-8): the test switches and finds both kept. |
| QC-9 | Safety | A test chat from the development provider never counts as pending after the switch (FR-SETUP-04-8): the test switches and finds the test chat not pending. |

## Cross-cutting

n/a: docs/CROSS-CUTTING.md has no filled row for Setup; the cross-cutting rules live in docs/tp/TP.md.

## Edge cases

- The owner has no catalog yet: Setup accepts a profile and an empty or one-item catalog and says so.
- The owner changes their mind about an answer after confirming: Setup shows the profile again and asks for a new confirmation.
- The test message does not arrive: Setup suggests checks in order (right number, connection, secrets, Deputy running) and does not pass the step.
- The test message arrives but the owner is away: Setup stays at step 6 and resumes at the same step.
- The owner approves the draft but sending fails: Setup says it failed. A retry needs a new approval.
- The owner answers the test chat from the app before approving: Setup shows that answer and asks for a new approval, as for any draft.
- The owner switches to the real provider with a profile that mentions test data: Setup asks the owner to review it.
- The owner sends the test from their own owner number: it is not a customer message, so Setup asks for another phone.

## Information

- Profile and catalog drafts and their confirmation (time).
- Mode (real or test).
- Test message, its draft, the approval with the owner's words, and the delivery result.
- Completion time.
- Total time and provider wait time.

## Open questions

1. Can the agent infer part of the profile from the owner's existing WhatsApp Business profile, and should it?
2. How does an owner with one phone run the real test: is "ask someone else" enough, or should Setup offer a second option?
3. Should the final summary say where Notify is set up, or leave that to the Notify slice?

## Acceptance criteria

Generated from the examples above, one per EX row:

- AC-1: Given step 5 and the owner answers the questions, When Setup shows the profile and catalog, Then it hands them to Knowledge only after the owner confirms. (EX-1)
- AC-2: Given the owner has no catalog yet, When Setup accepts the profile, Then it accepts a profile with an empty or one-item catalog and says so. (EX-2)
- AC-3: Given step 6 is reached, When the agent asks for the test, Then it asks the owner to send "Hi, do you have empanadas?" to the business number from another phone. (EX-3)
- AC-4: Given an owner has no second phone, When Setup asks for the test, Then the owner is offered test mode, or to ask someone else to send it. (EX-4)
- AC-5: Given the test message arrived and the draft exists, and the owner has not approved it, When Setup is checked, Then Setup is not complete. (EX-5)
- AC-6: Given the provider accepted the send, and the owner says it did not arrive, When Setup is checked, Then Setup is not complete. (EX-6)
- AC-7: Given the test reply is drafted and the owner has not approved it, When Setup handles the reply, Then Setup does not send it and is not complete. (EX-7)
- AC-8: Given the owner answers the test chat from the app before approving, When Setup handles the answer, Then it shows that answer and asks for a new approval. (EX-8)
- AC-9: Given the owner approved the reply, and sending failed, When Setup reports it, Then it names the failed part and stays at step 6. (EX-9)
- AC-10: Given the test message does not arrive, When Setup checks, Then it suggests checks in order and does not pass the step. (EX-10)
- AC-11: Given an owner with no WhatsApp account, When they run test mode, Then Setup completes with the development provider and shows "test". (EX-11)
- AC-12: Given test mode is running, When the setup steps run, Then steps 2, 3 and 4 are skipped. (EX-12)
- AC-13: Given test mode is complete, When the owner switches to the real provider, Then the profile and catalog remain and steps 2 to 4 run again. (EX-13)
- AC-14: Given test mode is complete with a test chat, When the owner switches to the real provider, Then the first real inbox does not show the test chat as pending. (EX-14)
- AC-15: Given Setup is complete, When the final screen is shown, Then it lists what is connected, the owner numbers, where data lives, how to ask what is pending, and the total time. (EX-15)
- AC-16: Given the round trip has not passed, When the owner asks for the final summary, Then no final summary is shown, because the summary is shown on completion. (EX-16)
- AC-17: Given Notify is available for the agent, When Setup offers push notices, Then they are labeled optional. (EX-17)
- AC-18: Given the agent does not support push notices, When Setup completes, Then it completes without them. (EX-18)
- AC-19: Given the owner approved the draft, When the reply arrives on the other phone, Then Setup is marked complete and shows the final summary. (EX-19)

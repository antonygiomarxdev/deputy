# FRD-04: Profile, catalog, test and finish

Status: Approved (2026-11-18) · Slice: Setup · Part of [Setup PRD](../PRD.md)

## Summary

Setup helps the owner write a first business profile and catalog, proves everything works with a test message answered by an approved draft, and ends with a summary of what is connected. Test mode does the same with no WhatsApp at all. See [../PRD.md](../PRD.md).

## Requirements covered

R-SETUP-16, R-SETUP-17, R-SETUP-18, R-SETUP-19.

## Behavior

| ID | Pattern | Requirement |
|---|---|---|
| FR-SETUP-04-1 | always | In step 5 the agent asks the owner short questions about the business (what it sells, hours, area, payment and delivery rules, tone) and the items for sale (name, price, notes). One question at a time. |
| FR-SETUP-04-2 | always | Setup shows the resulting profile and catalog to the owner and asks for confirmation. Setup hands them to Knowledge only after the owner confirms. A small catalog is accepted. Setup says it can be improved later. |
| FR-SETUP-04-3 | always | Step 6 asks the owner to send a message to the business number from another phone. An owner without a second phone is offered test mode, or to ask someone else to send it. |
| FR-SETUP-04-4 | always | The test message must appear in the inbox. Then the agent drafts a reply, the owner approves it in the conversation, the provider accepts the send, and the owner states that the reply arrived on the other phone. Setup is marked complete only when all of that has happened. Deputy knows only that the provider accepted the send, so arrival is the owner's word. |
| FR-SETUP-04-5 | always | The test reply is an ordinary draft: it needs the owner's approval like every reply. Setup does not send it itself. |
| FR-SETUP-04-6 | IF | If a part of the round trip fails, Setup says which part (message did not arrive, no draft, not approved, provider refused it, owner says it did not arrive) and what to do. Setup stays at step 6. |
| FR-SETUP-04-7 | always | Test mode needs no WhatsApp account and skips steps 2, 3 and 4. The round trip uses the development provider: the owner or the agent simulates a customer message, and the draft and approval work as in the real run. Test mode is marked "test" in the status and in the final summary. |
| FR-SETUP-04-8 | always | The owner can switch from test mode to the real provider later. The profile and catalog are kept. Test messages and test chats from the development provider stay as history. Once the provider is not the development one, they never count as pending, never appear in notices and are never offered a draft (Intake FR-INTAKE-01-10). Setup runs steps 2, 3 and 4 and a new round trip. |
| FR-SETUP-04-9 | always | On completion, Setup shows: what is connected, which numbers are treated as the owner's, where the owner's data lives, how to ask the agent what is pending, and the total time and provider wait (FRD-01). |
| FR-SETUP-04-10 | always | Setup may offer push notices (Notify) as an optional extra for agents that support it, labeled optional. Setup completes without it. |

Example:

> Agent: Please send "Hi, do you have empanadas?" to your business number from another phone. Tell me when you have sent it.

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

## Acceptance tests

- Given step 5, When the owner answers the questions, Then Setup shows the profile and catalog and hands them to Knowledge only after the owner confirms. (FR-SETUP-04-1, FR-SETUP-04-2)
- Given the test message arrived and the draft exists, When the owner has not approved it, Then Setup is not complete. (FR-SETUP-04-4, FR-SETUP-04-5)
- Given the owner approved the draft, When the reply arrives on the other phone, Then Setup is marked complete and shows the final summary. (FR-SETUP-04-4, FR-SETUP-04-9)
- Given the reply was approved but sending failed, When Setup reports it, Then it names the failed part and stays at step 6. (FR-SETUP-04-6)
- Given an owner with no WhatsApp account, When they run test mode, Then Setup completes with the development provider and shows "test". (FR-SETUP-04-7)
- Given the provider accepted the send, When the owner says it did not arrive, Then Setup is not complete. (FR-SETUP-04-4, FR-SETUP-04-6)
- Given a completed test mode with a test chat, When the owner switches to the real provider, Then the first real inbox does not show the test chat as pending. (FR-SETUP-04-8)
- Given a completed test mode, When the owner switches to the real provider, Then the profile and catalog remain and steps 2 to 4 run again. (FR-SETUP-04-8)
- Given setup is complete, When the final screen is shown, Then it lists what is connected, the owner numbers, where data lives, how to ask what is pending, and the total time. (FR-SETUP-04-9)

## Open questions

1. Can the agent infer part of the profile from the owner's existing WhatsApp Business profile, and should it?
2. How does an owner with one phone run the real test: is "ask someone else" enough, or should Setup offer a second option?
3. Should the final summary say where Notify is set up, or leave that to the Notify slice?

# FRD-03: Safe send and outcome

Status: Approved (2026-11-18)

## Summary

Before a send, Deputy checks that the chat is up to date and that the owner has not already answered from the phone. After the send, the owner learns whether it worked. See [the slice PRD](../PRD.md).

## Requirements covered

R-DRAFTS-11, R-DRAFTS-12, R-DRAFTS-13, R-DRAFTS-14.

## Behavior

| ID | Pattern | Requirement |
|---|---|---|
| FR-DRAFTS-03-1 | WHEN | When an approved draft is about to be sent, Deputy first brings the chat up to date with the provider. (R-DRAFTS-11) |
| FR-DRAFTS-03-2 | IF | If the update cannot be completed, the send is held. Deputy tells the owner, for example "I could not check María's chat, so I held the send. Try again?" Nothing reaches the customer. (R-DRAFTS-11) |
| FR-DRAFTS-03-3 | always | Deputy then checks whether, since the draft was made, the owner answered that chat from the WhatsApp Business app, or the customer wrote again. Deputy uses the message source that Intake recorded. It never decides that from message content. (R-DRAFTS-11) |
| FR-DRAFTS-03-4 | IF | If either happened, the send is held. Deputy tells the owner what happened and offers three choices: send as is, edit, or drop the draft. (R-DRAFTS-11) |
| FR-DRAFTS-03-5 | IF | If the owner answered from the app, the agent shows the owner that answer. The draft is sent only after the owner approves again with a new go. "Send as is" needs that new go too. (R-DRAFTS-12) |
| FR-DRAFTS-03-11 | IF | If only a customer wrote again (no owner answer from the app), the owner's "send as is" counts as a go only if it names the draft (FRD-02). Otherwise the agent asks for a new go. Deputy offers all three choices in this case. (R-DRAFTS-11) |
| FR-DRAFTS-03-12 | always | Each held send, the owner's choice (send as is, edit, drop), and a voided approval are logged. (R-DRAFTS-11) |
| FR-DRAFTS-03-6 | always | After a send, the owner is told that the provider accepted it, or that it failed and why, in plain words. (R-DRAFTS-13) |
| FR-DRAFTS-03-7 | always | A failed send stays visible with its reason. It can be retried only after a new approval. No retry happens by itself, with one exception (decision D29): when the provider answers "too many requests" (429), nothing was delivered, and the approved send waits in a queue for that chat and is retried at the time the provider gives. Other chats are not delayed. Before the retry, every check of FR-DRAFTS-03-3 runs again, and Deputy also checks that the draft did not change. If anything changed, Deputy holds the send and asks the owner again. If the retry time falls outside WhatsApp's 24-hour window for that customer, the send fails at once and the owner is told. (R-DRAFTS-13) |
| FR-DRAFTS-03-8 | IF | If it is not known whether the first attempt reached the customer (for example, the connection dropped after the request), the owner is told this. Deputy does not retry. The owner decides, after checking the chat. (R-DRAFTS-13) |
| FR-DRAFTS-03-9 | WHEN | When the provider accepts a message, Deputy writes the "sent" event in the log and gives Intake the send identifier. Intake records the message in the chat once, as sent by Deputy. (R-DRAFTS-14) |
| FR-DRAFTS-03-13 | WHEN | When a send ends as "outcome unknown", Deputy resolves it against Intake by matching the chat, a time window around the send, and the text. When it finds exactly one match, it links that message to the send and records the send as sent. If it finds none, the state stays "outcome unknown" (a provider can lag, so "not found" does not mean "not delivered"), and the owner decides after checking the chat (FR-DRAFTS-03-8). If several messages in the window match by text (for example the owner wrote the same text from the app), the match is ambiguous: nothing is linked and the state stays "outcome unknown". Only a failure reported by the provider is recorded as "failed". A linked message is never treated as an owner answer from the app. (R-DRAFTS-13, R-DRAFTS-14) |
| FR-DRAFTS-03-10 | WHEN | When the provider later reports the same message back, it is not recorded a second time. (R-DRAFTS-14) |

## Edge cases

- Catch-up cannot complete (provider down, credentials rejected): held, owner told, nothing sent.
- The customer wrote again and the draft no longer answers the question: the owner chooses edit or drop.
- The owner answered from the app and the answer says the same thing: the owner can drop the draft.
- The provider reply is slow: Deputy waits, and if the outcome is unknown it follows FR-DRAFTS-03-8.
- Session closed during the send: on the next start, the log shows the draft as "sent", "failed" or "outcome unknown", never as waiting for a repeat send (FR-DRAFTS-02-12).
- The provider's report of Deputy's own message arrives before Deputy gives Intake the send identifier: Intake still ends with one message, with source "sent through Deputy", and the report is never treated as an owner reply from the app, so no later draft is held for that false reason.
- The owner approved and then the chat changed: the old approval does not cover the held send; FR-DRAFTS-03-5 requires a new go.

## Information

- Per draft at send time: catch-up result, whether an owner reply from the app or a new customer message came after the draft, the owner's choice.
- Per send: provider result (accepted, failed, unknown), reason in plain words, send identifier.

## Acceptance tests

- Given an approved draft and a provider that cannot be reached for the update, When the agent sends, Then the send is held and the owner is told. (FR-DRAFTS-03-2)
- Given an approved draft, When the owner answers that chat from the app and then the agent sends, Then the send is held, the owner sees that answer, and nothing goes out until the owner approves again. (FR-DRAFTS-03-4, FR-DRAFTS-03-5)
- Given an approved draft, When the agent sends, Then before the provider is asked Deputy has brought the chat up to date and checked for an app reply and a new customer message, using the sources Intake recorded. (FR-DRAFTS-03-1, FR-DRAFTS-03-3)
- Given a customer who wrote again after the draft, When the owner says "send as is" without naming the draft, Then nothing is sent and the agent asks for a go that names it. (FR-DRAFTS-03-11)
- Given a held send, When the owner picks edit, Then the choice and the held reason are in the log. (FR-DRAFTS-03-12)
- Given the provider reports Deputy's own message before Intake has the send identifier, When both have arrived, Then the chat holds one message, as sent through Deputy, and the next draft for that chat is not held. (FR-DRAFTS-03-9, FR-DRAFTS-03-10)
- Given a send with outcome unknown and a message in the chat with the same text inside the time window, When Deputy resolves it, Then the message is linked to the send, the draft shows as sent, and the next draft for that chat is not held as "owner answered". (FR-DRAFTS-03-13)
- Given a send with outcome unknown and no matching message after catch-up, When Deputy resolves it, Then the state stays "outcome unknown", the owner is told it is still uncertain and decides after checking the chat, and nothing is sent again without a new go. (FR-DRAFTS-03-13)
- Given a send with outcome unknown and two messages in the window with the same text, When Deputy resolves it, Then nothing is linked and the state stays "outcome unknown". (FR-DRAFTS-03-13)
- Given an approved draft and a provider that answers 429 with a retry time 40 seconds ahead, When the time comes and nothing changed in the chat, Then the message is sent once. When the customer wrote in between, Then the send is held and the owner is asked again. When the retry time is after the 24-hour window closes, Then the send fails at once and the owner is told. (FR-DRAFTS-03-7)
- Given an approved draft and a provider that fails the send, When the agent sends, Then the owner is told why, the log shows "failed", no duplicate arrives later, and a retry is refused until a new approval. (FR-DRAFTS-03-6, FR-DRAFTS-03-7)
- Given a send whose outcome is unknown, When the owner is told, Then Deputy does not retry by itself. (FR-DRAFTS-03-8)
- Given an accepted send, When the provider reports the message back later, Then the chat holds the message once, as sent by Deputy. (FR-DRAFTS-03-9, FR-DRAFTS-03-10)

## Open questions

1. How long may the update of the chat take before Deputy gives up and holds the send?
2. How does Intake mark a send whose outcome is unknown?

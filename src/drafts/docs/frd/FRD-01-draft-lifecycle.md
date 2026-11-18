# FRD-01: Draft lifecycle

Status: Approved (2026-11-18)

## Summary

The agent prepares a reply for a chat. Deputy keeps it as a draft that waits for the owner. The owner can see, edit, reject or approve it. See [the slice PRD](../PRD.md).

## Requirements covered

R-DRAFTS-1, R-DRAFTS-2, R-DRAFTS-3, R-DRAFTS-4, R-DRAFTS-5.

## Behavior

- **FR-DRAFTS-01-1.** Deputy offers the agent a way to create a draft for a chat. The draft holds the chat, the proposed text, the time it was made, and the time of the latest message in that chat at that moment. Deputy gives it an identifier the owner can refer to (a short number or name). Identifiers are unique and never reused, not even after a draft is closed. Reply drafts and order drafts share one numbering, so "go on 3" never means two things. (R-DRAFTS-1)
- **FR-DRAFTS-01-2.** A new draft is never sent. Its state is "waiting for the owner's go". Creating a draft sends nothing to the provider. (R-DRAFTS-2)
- **FR-DRAFTS-01-3.** The owner can ask "what drafts are waiting?". The agent shows each waiting draft with its identifier, the chat, the proposed text exactly as it would be sent, and the customer message it answers. (R-DRAFTS-3)
- **FR-DRAFTS-01-4.** Deputy offers other slices a way to ask which chats have a draft waiting. For each draft that has not been sent it returns the chat, the time the draft was written, and its state (waiting, held, failed or unknown). It does not return the draft text. (R-DRAFTS-3)
- **FR-DRAFTS-01-5.** The owner can ask the agent to change a draft's text. Deputy keeps the new text, and the draft goes back to "waiting for the owner's go". Any approval given for the earlier text is void. (R-DRAFTS-4)
- **FR-DRAFTS-01-6.** The owner can reject a draft. A rejected draft is closed and can never be sent. (R-DRAFTS-4)
- **FR-DRAFTS-01-7.** A chat has at most one open reply draft and at most one open order draft (open means waiting, approved, or held, but not yet sent). When the agent creates a new draft for a chat that already has an open draft of the same kind, the new draft replaces the old one, the old one is closed as "replaced", and any approval of the old one is voided. A new reply draft never replaces an order draft, and the other way round. A draft already being sent cannot be replaced. The agent tells the owner that it replaced a draft. (R-DRAFTS-5)
- **FR-DRAFTS-01-8.** Once the provider setting is not dev, Deputy refuses to create a draft for a chat whose only messages are dev test messages, and says why (FR-INTAKE-01-10). (R-DRAFTS-1)

Example:

> Owner: tell María yes, we deliver Saturday.
> Agent: Draft 1 for María: "Yes, we deliver on Saturday. What time works for you?" It answers: "Do you deliver on weekends?" Say go on 1 to send it.

## Edge cases

- The chat does not exist or has no customer message: Deputy refuses to create the draft and says why.
- The chat's only messages are dev test messages and the provider is no longer dev: refused (FR-DRAFTS-01-8).
- Empty text: refused.
- The owner changes the text of a draft that was already approved but not yet sent: the approval is void and the draft waits again (FR-DRAFTS-01-5).
- The owner asks to change or reject a draft that was already sent, rejected or replaced: Deputy says it is closed and changes nothing.
- The owner says "reject 4" and draft 4 does not exist: Deputy says so and changes nothing.
- The agent creates a draft while the owner is looking at the older draft for that chat: the owner is told the older one was replaced, so they do not approve text that no longer exists.
- No drafts waiting: the list says so plainly.
- A draft the owner did not approve is still there in the next session. It is marked as from an earlier session, and the send path checks the chat as for any draft (decision D25).

## Information

- Draft: identifier, chat, proposed text, current text, state (waiting, approved, held, sending, sent, failed, outcome unknown, rejected, replaced), time made, time of the latest chat message when made, the customer message it answers.
- Per chat: whether a draft is waiting, and the time it was written (for Inbox and Knowledge).

## Acceptance tests

- Given a chat with a customer question, When the agent creates a draft, Then the draft shows as waiting, nothing is delivered to the provider, and the owner can see it with the question it answers. (FR-DRAFTS-01-1, FR-DRAFTS-01-2, FR-DRAFTS-01-3)
- Given an approved draft not yet sent, When the owner changes its text, Then the draft is waiting again and the earlier approval no longer counts. (FR-DRAFTS-01-5)
- Given a chat with a waiting draft, When the agent creates another draft for that chat, Then only the new draft is waiting, the old one is closed as replaced, and the owner is told. (FR-DRAFTS-01-7)
- Given a draft that is approved but not yet sent, When the agent creates a new draft for that chat, Then the old draft is closed as replaced, its approval is void, and trying to send it is refused. (FR-DRAFTS-01-7)
- Given a chat with an open reply draft, When the agent creates an order draft for it, Then both stay open, and a new reply draft later replaces only the reply draft. (FR-DRAFTS-01-7)
- Given a reply draft and an order draft, When they are created, Then they get different identifiers from one shared numbering. (FR-DRAFTS-01-1)
- Given a chat with only dev test messages and the provider set to Kapso, When the agent creates a draft for it, Then Deputy refuses. (FR-DRAFTS-01-8)
- Given drafts that are waiting, held, failed and unknown, When Inbox asks, Then each comes with its chat, time written and state, and no text. (FR-DRAFTS-01-4)
- Given a draft that was closed, When the agent creates a new draft, Then the new identifier differs from every earlier one. (FR-DRAFTS-01-1)
- Given two chats with waiting drafts, When Inbox asks which chats have a draft waiting, Then it gets exactly those two chats, each with the time its draft was written. (FR-DRAFTS-01-4)
- Given a waiting draft, When the owner rejects it, Then it is closed and a later attempt to send it is refused. (FR-DRAFTS-01-6)

## Open questions

1. Should the draft show exactly what will be sent, including line breaks and any signature line? (PRD open question 1.)
2. How is the draft identifier shown so it stays unambiguous when many drafts are waiting?

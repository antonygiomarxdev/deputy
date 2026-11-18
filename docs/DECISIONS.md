# Decisions

Product decisions made by the owner, and design decisions the lead made while reviewing the slice documents. Newest decisions are added at the end with the next number. Technical decisions go in ADRs (`docs/adr/` for decisions that span slices, `src/<slice>/docs/adr/` for one slice), written with the Technical Proposal.

## Owner decisions

| ID | Date | Decision |
|---|---|---|
| D1 | 2026-11-17 | **The owner's go.** The agent asks in any form (a list, numbered drafts). The go is the owner's reply that clearly identifies which drafts it approves. A reply that does not is not a go, and the agent asks again. One reply may approve several drafts only if it identifies each one; each gets its own approval entry with the owner's words. |
| D2 | 2026-11-17 | **Orders.** An order is recorded only after a go under D1. The owner's own command about an order ("mark Juan's order delivered") is the go for that change. |
| D3 | 2026-11-17 | **Inbox window.** Only customer messages from the last N days count as pending. N is the owner's setting, default 7 days, up to what the provider holds. Older messages stay available as history. |
| D4 | 2026-11-17 | **Inbox groups.** Each pending chat is in exactly one group: needs the owner, then orders, then easy questions. The agent judges the group; when unsure, "needs the owner". |
| D5 | 2026-11-17 | **Notices.** Counts only: no customer text, no names. They cover new messages and chats still unanswered, except chats the owner asked to ignore. Ignoring is an explicit owner command and can be undone. Batching default 10 minutes. While unanswered chats exist, a reminder is sent even with no new messages, default every 30 minutes, separate from batching; the owner can change or pause it. |
| D6 | 2026-11-17 | **Credentials.** The owner enters provider keys and secrets outside the agent conversation, never in the chat. |
| D7 | 2026-11-17 | **Principle 8.** Data stays on the owner's machine unless the owner chooses their own spreadsheet. |
| D8 | 2026-11-17 | **Answering from the phone (UC-4)** is covered by the agent's own remote access; it is not a slice. |
| D9 | 2026-11-17 | **Learning: open.** Nothing is learned without the owner's ok, and each learned item links to the chat and draft it came from. How facts, tone and one-customer cases are told apart is still to design (Knowledge slice). |
| D10 | 2026-11-17 | **Media in v1.** Deputy stores that a media message arrived and its type. If the provider gives a transcript, it is shown as customer text. |
| D11 | 2026-11-17 | **Known limit.** Deputy offers no way to send except an approved draft. An agent with other tools could bypass Deputy; the documents say so instead of claiming it is impossible. |
| D12 | 2026-11-17 | **Receiving.** By default Deputy checks the provider when the session opens and then periodically while it is open (default every 2 minutes, minimum 1). No public address is needed. Live delivery is an optional advanced setting. Setup asks the owner which mode they want and explains the difference. |

## Lead decisions (design, from the reviews)

| ID | Date | Decision |
|---|---|---|
| L1 | 2026-11-17 | Setup installs Deputy into the agent first, in test mode, so its checks exist from step 1. Test mode skips the provider steps. |
| L2 | 2026-11-17 | A message from the owner's number is "sent through Deputy" only when it matches one of Deputy's send identifiers. Anything else from the owner's number is "owner from the app". A wrong "owner" label only holds a send; the other mistake would answer over the owner. |
| L3 | 2026-11-17 | Dev test messages never count as pending, notified or draftable once the provider is not dev. |
| L4 | 2026-11-17 | The ignore list (owned by Inbox) and the owner numbers change only by an explicit owner command, logged with the owner's words, and the owner can list them at any time. |
| L5 | 2026-11-17 | Reply drafts and order drafts share one numbering. A chat may have one waiting reply draft and one waiting order draft. |
| L6 | 2026-11-17 | Order entries in the drafts log keep the owner's words while the order exists. Deleting an order replaces them with "deleted", so no personal data remains. |

# ADR-006: Drafts, the owner's go and one send path

## Status
Proposed

## Context
Principle 1 and D1: nothing goes out without the owner's go in the conversation. D11: Deputy offers no way to send except an approved draft, and says that an agent with other tools could bypass it. FR-DRAFTS-02-12 needs mark-used-before-send. FR-DRAFTS-03-1 to FR-DRAFTS-03-4 need a fresh look at the chat before sending. From TP TD-6.

## Decision
- Tools create, list, change and reject drafts. Reply and order drafts share one numbering (L5).
- `approve_draft(number, shown_text, owner_words)` is the only tool that causes a send. Deputy refuses unless `shown_text` equals the draft's current text and `owner_words` contain the draft number as a whole token. Deputy hashes the text itself; the agent passes the text, not a hash.
- `approve_draft` refuses unless this process holds the lease, the text equals the draft's current text, the owner's words contain the draft number as a whole token, and the current version was returned by `list_drafts` after its last change. The token and shown checks are a guard against typos and wrong order, not authorization ("ok, 3 kilos is fine" contains "3"); the stop is that the owner saw the text and answered in the conversation.
- Send path, in order: one transaction (including the lease-token check) records the approval, marks it used, sets the draft to "sending" and writes the log; `CatchUpChat` runs with a time limit (20 seconds); if it fails or times out ("held, catch-up failed"), if the owner answered from the app, or the customer wrote again, the draft is held, the approval is void and the owner gets the three choices; otherwise the lease token is checked again in a transaction right before the provider call (a lost lease holds the send), and `SendText` is called.
- The outcome is recorded as sent, failed or unknown. Nothing retries on its own. Unknown is resolved by `ResolveUnknownSends` in Drafts, which asks Intake's `FindOutgoing(chat, since, text)` after the next catch-up (at start, and on every `CatchUpFinished` that stored messages); no match or several matches leave it unknown.
- `SendText` records the send id and pending text before the provider call and upserts the provider message id after it, so an echo that catch-up stored first is reclassified as "sent through Deputy", not duplicated.
- On sent, the send identifier goes to Intake, which stores the message once as "sent through Deputy".
- For an order draft, the same tool records the order instead of calling the provider (D2). The transaction sets the draft "recording"; `RecordOrder` is idempotent on the draft number (read before append on a spreadsheet); then the draft is marked recorded. A draft left "recording" is re-driven at start, which is safe (unlike a send).
- Order drafts are prepared by Orders' `PrepareOrder` at `create_draft` (required details, catalog resolution, price snapshots, total). `create_draft` also checks that the chat exists in Intake.
- The rules live in the `Draft` aggregate and the `ApproveDraft` use case. The provider is behind the `Sender` port, the chat check behind `ChatFreshness`, order recording behind `OrderRecorder` (ADR-000).
- No tool sends free text. No agent permission setting replaces the go.

## Alternatives
- A transactional outbox (approve queues, a worker sends): the owner hears "approved" before any check, and a queued send can fire after the owner changed their mind.
- The agent's permission prompt as the go: rejected by D1; absent in other agents.
- Separate approve and send tools: leaves approved-but-unsent states and an out-of-order call.
- A hash passed by the agent: agents cannot compute hashes reliably, and FR-DRAFTS-02-3 asks for the text.

## Consequences
- Easier: one place enforces the go; the log shows every step.
- Harder: one call per draft when the owner approves several.
- Watch: a crash after "mark used" shows "outcome unknown" though nothing was sent (accepted); split replies can fail partway (treated as unknown); invented owner words cannot be detected (D11).

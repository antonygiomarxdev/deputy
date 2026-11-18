# ADR-011: A rate-limited send is queued per chat and retried with every check

## Status
Proposed

## Context
Owner decision D29: an approved send that gets a 429 waits in a queue per customer chat, so a hold in one chat never stops the others. It is retried at the time the provider gives. Before the retry, every pre-send check runs again. If anything changed, Deputy holds and asks the owner again. This replaces "429 is failed and needs a new go". A 429 means the provider refused before it processed the request, so a retry cannot double a message. From TP-03 TD-3.

## Decision
- On `rate_limited` with `retryAt`, the draft stays "sending" with `retry_at` and `attempts` set. A "sending" draft cannot be changed, rejected or replaced, so the approved text cannot change in the queue.
- One timer per chat (`RetryScheduler`); a chat has at most one open reply draft, so one queued send.
- At `retry_at`, `RetrySend` re-runs the lease check, the draft check, the window check, the catch-up and the freshness check. Any change holds the send with the normal hold. The owner is told by a `SendNeedsOwner` signal and a notice.
- Each attempt uses a new send id, because Intake sends nothing for a repeated id.
- At start, `RecoverInterrupted` re-schedules drafts with `retry_at` instead of making them "unknown".

## Alternatives
- Sleep in the send path: the call hangs and one wait can stop other chats.
- Keep "failed, needs a new go": the owner repeats a go for a delay that is not their fault.

## Consequences
- Easier: the owner approves once; a busy provider costs a delay, not a repeated go.
- Harder: a timer per chat, a column, and a way to tell the owner without a tool call.
- Watch: Intake must return `retryAt`; when the header is missing it uses 60 seconds.

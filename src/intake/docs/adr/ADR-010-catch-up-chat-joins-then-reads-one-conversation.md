# ADR-010: CatchUpChat waits for the running catch-up, then reads that one conversation

## Status
Proposed

## Context
Before every send Drafts needs the chat to be fresh (FR-DRAFTS-03-1). Cross-cutting TD-5 says the pre-send catch-up shares the single-flight lock with the timer. A run that began before the owner answered from the app cannot see that answer. From the Intake TP-03, TD-4.

## Decision
`CatchUpChat` waits for any running catch-up to end (up to `waitMs`), then reads the chat's conversation newest first until a message older than the chat's newest stored message minus the overlap, and one page of the number's outbound listing. It stores through the same service. It moves no mark and emits no `CatchUpFinished`. It returns the chat state afterwards. A failure or the time limit returns `failed`; it never waits for a rate limit.

## Alternatives
- Return the shared run's result: no extra requests, but misses an echo that arrived after that run read the listing.
- Run a full catch-up each time: correct, but costs a conversation listing plus one request per active conversation on every send.

## Consequences
- Easier: the pre-send check sees owner replies up to the provider's own lag.
- Harder: two to three extra requests per send.
- Watch: a chat with no known conversation reference falls back to a conversation listing active in the last day.

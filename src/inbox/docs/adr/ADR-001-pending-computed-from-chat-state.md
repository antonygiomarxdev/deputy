# ADR-001: Pending is computed on demand from Intake's chat state

## Status
Accepted (2026-11-18)

## Context
Inbox must say which chats wait for a reply (FR-INBOX-01-1 to 01-4) and must never be wrong about an owner reply made from the phone (R-INBOX-2, principle 2). FRD-01 says pending status "is worked out each time, not stored". Intake already keeps, per chat, the newest customer time and the newest answer time and source, recomputed inside the store transaction (cross-cutting TD-3, Intake TP-02). From TP-01 TD-1.

## Decision
- `ChatScanner` calls Intake's `ListChats` once and judges each chat with the pure `PendingPolicy` from `lastCustomerAt`, `lastAnswerAt`, the chat's mark, the ignore list and the window start.
- Inbox stores no pending state.
- When `lastCustomerAt` equals `lastAnswerAt`, the scan reads `ReadChat({ chat, limit: 5 })` and takes the source of the newest non-dev message. Deputy never guesses an order.

## Alternatives
- A table fed by `MessageStored`: the event is only a hint and one signal can be lost after a crash (Intake TP-02), so a chat could stay pending after an owner reply from the phone. It also adds a repair path.
- Scan every message of every chat: with 2,000 chats of 100 messages that reads 200,000 rows to answer a question two timestamps answer.

## Consequences
- Easier: Inbox, Notify and the summary share one rule and cannot disagree. No migration for pending state.
- Harder: the cost of an ask grows with the number of chats; one indexed read at the expected size.
- Watch: Intake's `ChatStateView` is the contract. A change there changes Inbox's tests first.

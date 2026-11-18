# ADR-003: Live deliveries are verified inside the use case through the Provider port

## Status
Proposed

## Context
FR-INTAKE-02-1 and 02-2 need a signature check before anything is stored, a rejection note on failure, and the rejection reasons `no secret` and `no identifier`. The provider must answer within 10 seconds (`docs/research/kapso.md` Q4). From the Intake TP-02, TD-1.

## Decision
`ReceiveLiveDelivery({ rawBody, headers })` is the only way a live delivery reaches storage. It checks the lease, the live-delivery policy and the secret, then calls `Provider.verifyAndParse`. The Kapso adapter does the constant-time HMAC over the raw body. The use case writes the rejection note, stores through the shared `StoreMessages` service in one transaction, and returns `stored`, `rejected` or `storage_failed`. The HTTP listener maps those to 200, 401 and 500 and holds no rule.

## Alternatives
- Verify in the HTTP listener, call the use case only with parsed messages: rejection notes and the no-secret case would live in an adapter and need a real server to test.
- Verify in a middleware shared with the dev routes: dev and Kapso would diverge on what "valid" means.

## Consequences
- Easier: every FR-INTAKE-02-1 to 02-3 case runs in memory with a fake provider.
- Harder: the Provider port carries a verify method that the dev adapter implements with its fixed secret.
- Watch: the whole path must stay under 10 seconds; only one transaction and no provider call runs inside it.

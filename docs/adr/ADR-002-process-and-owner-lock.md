# ADR-002: One owner process per data folder, chosen by a lease row in SQLite

## Status
Proposed

## Context
A stdio server lives as long as its client session, and two sessions mean two processes. Both would poll, send notices, bind the port and write the same data (`docs/research/agents.md` Q3). PRODUCT says Deputy is not always on. A lock file with a pid (the first proposal) has a takeover race between two losers, fails when the owner deletes the file, suffers pid reuse, and needs a read-only open of a WAL database that is unverified on Windows. From TP TD-2.

## Decision
- A `lease` row in the SQLite file holds `{token, holder_started, heartbeat}`. The owner renews it every 10 seconds. The lease lasts 30 seconds without a renewal. Why: a renewal is one tiny write, so six a minute cost nothing; 30 seconds is three renewals, so a stall of up to 20 seconds (garbage collection, a busy disk, a short pause) does not lose the lease; a dead owner is replaced within 30 seconds, under the default 2-minute catch-up period, so no run is lost. Both are domain constants.
- Taking over is one statement, `UPDATE ... WHERE token = :seen AND heartbeat < now - 30 s`. Only one process can win. The token is random and held in memory.
- `OwnerLease` is an outbound port in the shared kernel; the adapter is the lease row. `isOwner()` reads the row and compares the token on every call. The send transaction includes the token check, so a process that lost the lease cannot mark an approval used.
- Read-only mode is enforced in the application layer: every use case that writes or sends asks `OwnerLease` and refuses with a plain reason when this process is not the owner. All inbound adapters (MCP, scheduler, listener) get the same rule. Reads still work. `ReadInbox` skips its catch-up and warns that it is not refreshing.
- On every lease acquisition the new owner runs recovery (Intake `MarkInterruptedSends`, Drafts `RecoverInterrupted`, the order and outbox re-drives, and Notify's `StartNoticeSession`) before it starts the scheduler.
- A `LeaseSupervisor` in the composition root tries the lease every 10 seconds. It starts the scheduler and the listener when this process becomes owner and stops them when it loses the lease. The port is bound only after the lease is won.
- The lease is released (heartbeat cleared) on stdin close, SIGINT and SIGTERM.

## Alternatives
- A lock file with a pid: race, deleted-file and pid-reuse failures, as above.
- A separate always-on daemon: an extra thing to install and run; against "not always on".
- No lease: duplicate polling and notices, `EADDRINUSE`, two writers.

## Consequences
- Easier: one place for every side effect; no duplicate sends; the rule is unit-tested with an in-memory lease.
- Harder: a crashed owner delays takeover by up to 30 seconds; a small write every 10 seconds; a second session cannot draft or send until it owns the lease.
- Watch: a laptop that sleeps loses the lease and finds out at its next write check; cleanup must be fast because Claude Code ends the process within about 400 ms.

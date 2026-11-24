# TP: testing

Part of [TP.md](../tp/TP.md). Moved verbatim from there; nothing changed.

## Testing

ATDD (D13). The order of work for each FRD:

1. Turn each Given/When/Then line into a test, titled with the FR id it tests, before any code. The FRD lines already end with `Tests FR-...`.
2. Write the slice code until the unit tests pass.
3. Run the end-to-end test for that slice.

The architecture test (`test/architecture.test.ts`) reads every `.ts` file under `src/`, parses its imports and fails on: `domain` importing outside `domain` and `src/shared/`; `application` or `ports` importing `adapters`; a slice importing a file of another slice other than its `index.ts`; a cycle in the graph of slice-to-slice imports; Drafts importing Inbox, Notify, Knowledge or Setup; any file under `src/adapters/` importing a slice, or any file other than a slice's `adapters/` folder, `src/composition/` and `src/main.ts` importing `src/adapters/`; any file under `src/composition/` importing anything of a slice other than its `index.ts`, or any file other than `src/main.ts` importing `src/composition/`; any import of `src/main.ts`; any adapter instantiated outside `src/main.ts` and `src/main/`; any import of `src/main/` other than from `src/main.ts` or `src/main/`; any bare package specifier or runtime module (`bun:*`, `node:*`) imported from `domain/`, `application/`, `ports/` or `src/shared/`, because libraries live only in adapters (ADR-000). Each use case has acceptance tests driven through its inbound port with in-memory adapters (an in-memory repository, a fake provider, a fake clock).

Test layers:

| Layer | What | How |
|---|---|---|
| Domain unit, per slice | rules: pending, batching, quiet periods, approval checks, totals, normalization | `bun test`, no I/O, fake clock |
| Use case acceptance | each FRD's Given/When/Then through the inbound ports | in-memory adapters |
| Adapter contract | the same repository tests run against the in-memory and the SQLite adapter (and the spreadsheet adapter against a fake) | `bun test`, in-memory SQLite |
| Architecture | the dependency rule | import parsing |
| End to end | the server over stdio, the dev provider, a fake Kapso HTTP server | the existing harness (`start`, `call`); the fake serves conversations and messages with cursors, `X-RateLimit-*`, `429` with `Retry-After`, `business_app` echoes, delays and outages |
| Concurrency | two processes on one data folder | use case tests with an in-memory `OwnerLease`; two real servers: one owner, one read-only; two losers racing to take over a dead lease (one wins); a lease lost mid-send blocks the approval (TD-2) |
| Crash | kill the process between "mark used" and the provider call; between "mark used" and the order record; between the order delete and the scrub | assert "outcome unknown" at restart and no resend (FR-DRAFTS-02-12); the order is recorded once; the scrub completes once |
| Live check | one real message and one echo through Kapso, with the sender format of the echo for AR, MX and BR numbers where available; a Google token request and `Bun.secrets` from the compiled binary on Windows, macOS and Linux (with and without a secret service) | by hand once per release |
| Escape helper | one helper, `src/adapters/mcp/customer-text.ts`, escapes `&`, `<` and `>`; a message and a profile name that contain `</customer_text>` render inside one label in `get_chat`, `list_drafts`, `inbox` and `list_ignored`, and an architecture test finds no other file that writes the label | `bun test` |
| Lease acquisition | the recovery order on every acquisition is `MarkInterruptedSends`, `RecoverInterrupted`, a catch-up, `ResolveUnknownSends`, `RedriveRecording`, `RedriveOutbox`, `StartNoticeSession`, and only then the scheduler and the listener start; a second acquisition after a loss runs it again | use case tests with an in-memory `OwnerLease` |
| Secure delete | after an order is deleted, a byte search of the database file and its write-ahead log finds none of its text | `bun test`, a real SQLite file |
| Migration | the composition root's list gives each slice's files one global number, with no gap and no repeat; an upgrade from every released version's fixture database; a failing migration changes nothing; the append-only triggers survive (TD-3) | `bun test`, fixtures in `test/fixtures/db/` |
| Time | quiet periods across the spring and fall DST days in America/New_York (TD-7) | fake clock and `Intl.DateTimeFormat` |
| Language | every code has an English default text and no text holds customer or provider content (D20) | domain unit |

Gates before a commit: `bun test` and `bun run typecheck` (CLAUDE.md). A user-facing change needs a changeset.

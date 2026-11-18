# ADR-000: Ports and adapters with DDD; one bounded context per slice

## Status
Accepted (2026-11-18)

## Context
Owner decision D14: Deputy is rebuilt with hexagonal architecture, DDD and clean architecture. The old structure (`server.ts`, `conversations.ts`, `providers/`, `store/`) is not kept. The provider, the storage, the agent and the push channel all change or vary, and the FRDs' Given/When/Then lines are rules that should run without them. From TP TD-0.

## Decision
- Each slice is a bounded context in `src/<slice>/` with:
  - `domain/`: entities, value objects, domain services, domain events. No I/O, no framework. Imports only `domain/` and `src/shared/`.
  - `application/`: use cases. Depends on `domain/`, `ports/` and `src/shared/`.
  - `ports/`: inbound ports (use-case interfaces) and outbound ports (repositories, provider, clock, notifier).
  - `adapters/`: implementations of outbound ports.
  - `index.ts`: the published surface (inbound port types, event types, factory).
- Shared kernel `src/shared/`: small value objects (`ChatId`, `MessageId`, `Source`, `OwnerWords`), the `Clock` and `OwnerLease` ports, the cross-slice signals in `signals.ts` (`SendNeedsOwner`, `OwnerReplyUnlinked`), and the functions `normalizeText`, `wholeNumberTokens` and `foldName`.
- Slices talk only through published inbound ports or domain events. A consumer defines the outbound port it needs; an adapter in the consumer calls the other slice's `index.ts`.
- Inbound adapters: the command line (`deputy config`, `deputy secrets`; it writes a pending-change row or a file and calls no use case; the agent never sees it), the MCP server (`src/composition/mcp/`, tools mapped to use cases, L8), the optional live-delivery HTTP listener, the scheduler. Outbound adapters: Kapso and dev providers, SQLite repositories, owner files, spreadsheet, Claude channel notifier, owner lease (the `OwnerLease` adapter).
- Composition root: `src/main.ts` wires adapters to ports. Nothing else instantiates an adapter.
- Slice graph and shared adapters: the graph of slice-to-slice calls stays acyclic, and Drafts calls none of Inbox, Notify, Knowledge or Setup (where a tool needs two slices, such as the catalog mark on `list_drafts`, `src/composition/mcp/` composes them: it may import any slice's `index.ts`, and only `src/main.ts` imports it, L8). `src/adapters/` (shared adapter code such as `google/` and `cli/`) imports no slice; only a slice's `adapters/` folder, `src/composition/` and `src/main.ts` import it. `src/adapters/mcp/` holds only shared MCP code (`ToolDefinition`, the customer-text helper).
- Aggregates: Message (keyed by provider message id, holding a ChatId), SyncState, RejectionNote, OwnerNumbers (Intake; `Chat` is a small projection, not an aggregate that holds messages); IgnoreList and InboxSettings (Inbox); Draft and DraftLog (Drafts); NoticeState and NotifySettings (Notify); Proposal and LearnedItem (Knowledge; profile and catalog are owner files behind ports); Order (Orders); SetupProgress (Setup).
- Libraries stay behind ports. `domain/`, `application/`, `ports/` and `src/shared/` import no third-party package and no runtime module (`bun:*`, `node:*`); only relative imports. A library (phone parsing, CSV, JWT, SQLite, the keychain) is used only inside an adapter that implements a port. Runtime services with environment-dependent behavior (time zones, randomness, crypto) are reached through ports too (`Clock`, for example), so the domain stays pure and testable.
- An architecture test enforces the rules by parsing imports (see ADR-011). It fails on any bare package specifier or runtime module imported from `domain/`, `application/`, `ports/` or `src/shared/`, on a cycle in the slice graph, on Drafts importing Inbox, Notify, Knowledge or Setup, on a slice import from `src/adapters/` or an import of it from anywhere but a slice's `adapters/`, `src/composition/` or `src/main.ts`, and on any import of `src/composition/` other than from `src/main.ts`.

## Alternatives
- Keep the layered layout and add slice folders: the MCP server keeps the rules; tests need a real server and provider.
- Vertical slices with no ports: no in-memory tests of use cases; hard to swap provider or storage.

## Consequences
- Easier: use cases and FRD acceptance tests run with in-memory adapters; Kapso, dev, SQLite and spreadsheet are swappable; the send rule lives in one aggregate.
- Harder: more files and interfaces; a full rewrite; discipline to keep one use case per file and no generic frameworks.
- Watch: ceremony beyond what v1 needs; cross-slice calls growing into hidden coupling (the architecture test guards it).

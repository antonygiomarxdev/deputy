# Developing Deputy

Deputy is an MCP server over stdio that gives an agent (Claude Code first) the owner's WhatsApp Business inbox: it receives and stores customer messages and lets the agent draft answers that go out only after the owner's go.

- Runtime and package manager: Bun. No build step: Bun runs `src/` directly.
- `bun install`: install dependencies (`bun.lock` is committed).
- `bun test`: unit, adapter-contract, architecture and end-to-end tests (the end-to-end tests spawn `bun src/main.ts serve` over stdio).
- `bun run typecheck`: `tsc --noEmit`. Run it with the tests before committing.
- `bun src/main.ts serve`: start the server. Data lives in `DEPUTY_DATA_DIR` (default `data/`, gitignored) as `deputy.db`; config in `DEPUTY_CONFIG_DIR` (default `~/.deputy`).
- Never write to stdout from the server: it is the MCP transport. Log with `console.error`.

Layout (ports and adapters; ADR-000 in `docs/adr/`):
- `src/shared/`: the shared kernel (value objects, `Clock`, `OwnerLease`, `SqlDatabase`, text functions, signals). No package and no `bun:` or `node:` import.
- `src/<slice>/`: one folder per slice (today `intake`, with `drafts` and others following) holding `domain/`, `application/`, `ports/`, `adapters/` and an `index.ts` that is the only file other slices may import.
- `src/adapters/`: adapters shared by slices (SQLite, clock, supervisor, config, secrets, MCP tool helpers, event bus).
- `src/composition/`: the MCP server, its `instructions` and the tools that span slices. Only `src/main.ts` imports it.
- `src/main.ts`: the composition root, and the only place an adapter is built.
- `test/architecture/` enforces those import rules; `test/support/` holds fakes and the end-to-end harness.
- `business/`: the owner's profile and catalog template. `examples/` has filled-in examples.

New provider = implement `Provider` in `src/intake/ports/provider.ts`, put the adapter in `src/intake/adapters/<name>/` and build it in `src/main.ts`. New SQL migrations are numbered files under an `adapters/sqlite/migrations/` folder, appended to the list in `src/main.ts` (a file's position is its `user_version`).

Product docs: [docs/PRODUCT.md](docs/PRODUCT.md) holds the problem, principles, v1 scope and slice map. Each slice keeps its chain (PRD → FRDs → TPs per FRD → ADRs → specs) in `src/<slice>/docs/`; the cross-cutting TP is `docs/tp/TP.md`. Implementation is ATDD: acceptance tests from the FRD first. Product decisions: [docs/DECISIONS.md](docs/DECISIONS.md); terms: [docs/GLOSSARY.md](docs/GLOSSARY.md); cross-slice ADRs: `docs/adr/`.

Keep `README.md` (English) and `README.es.md` (Spanish) in sync. Use Mermaid for diagrams (validate them before committing).

Versioning: [Changesets](https://github.com/changesets/changesets). Any user-facing change (feature, fix, breaking config change) needs a changeset: `bun changeset`. Docs-only, test-only and internal chores don't.

Commits: follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`…). No `Co-Authored-By` or other attribution trailers.

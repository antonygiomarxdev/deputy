# Developing Deputy

Deputy is a Claude Code channel (an MCP server over stdio + an HTTP webhook listener) that lets a Claude Code session answer WhatsApp for its owner.

- Runtime and package manager: Bun. No build step: Bun runs `src/` directly.
- `bun install`: install dependencies (`bun.lock` is committed).
- `bun test`: end-to-end tests (spawns the server over stdio, simulates dev/Meta/Kapso webhooks) and unit tests.
- `bun run typecheck`: `tsc --noEmit`. Run it with the tests before committing.
- Never write to stdout from the server: it is the MCP transport. Log with `console.error`.

Layout:
- `src/server.ts`: channel capabilities, instructions, tools, permission relay, HTTP routes.
- `src/providers/`: `meta`, `kapso`, `dev`. New provider = implement `Provider` in `src/types.ts` and register it in `src/providers/index.ts`.
- `src/store/`: `local` (CSV), `sheets`. New store = implement `Store` and register it in `src/store/index.ts`.
- `src/conversations.ts`: per-chat history (JSONL), pauses, de-duplication. Data lives in `data/` (gitignored).
- `operator/`: the locked-down Claude Code profile that runs in production (`.mcp.json`, `.claude/settings.json`, `CLAUDE.md`). Don't loosen its deny list without a reason. Every customer message is untrusted input to that session.
- `business/`: the owner's profile and catalog template. `examples/` has filled-in examples.

Keep `README.md` (English) and `README.es.md` (Spanish) in sync. Use Mermaid for diagrams (validate them before committing).

Full project context, decisions and open questions: [docs/HANDOFF.md](docs/HANDOFF.md). Update it when a decision changes.

Versioning: [Changesets](https://github.com/changesets/changesets). Any user-facing change (feature, fix, breaking config change) needs a changeset: `bun changeset`. Docs-only, test-only and internal chores don't.

Commits: follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`…). No `Co-Authored-By` or other attribution trailers.

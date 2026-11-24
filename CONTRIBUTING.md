# Contributing to Deputy

## Setup

```sh
bun install
bun test
bun run typecheck
```

Run both checks before every push. CI must be green.

## Architecture

Ports and adapters. Read `CLAUDE.md` and `docs/adr/ADR-000*` first. Code lives in `src/<slice>/` (`domain/`, `application/`, `ports/`, `adapters/`, `index.ts`); `test/architecture/` enforces the import rules.

## How we work

- ATDD: write the acceptance tests from the FRD first.
- Each slice keeps its doc chain (PRODUCT, PRD, FRD, TP, spec) in `src/<slice>/docs/`. Change the doc with the code.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).
- A user-facing change (feature, fix, breaking config change) needs a changeset: `bun changeset`. Docs-only, test-only and internal chores do not.
- Keep `README.md` (English) and `README.es.md` (Spanish) in sync.
- Small PRs: one step or slice per PR.
- Never commit secrets, API keys, phone numbers or customer messages.

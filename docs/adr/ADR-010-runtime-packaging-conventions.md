# ADR-010: Bun and TypeScript, shipped as a compiled binary, zod validation, slice folders

## Status
Proposed

## Context
The repo runs on Bun with no build step. Tool arguments are cast as `Record<string, any>` today, which is untrusted input without validation (`docs/research/codebase.md`). `zod` is already a dependency. A non-technical owner should not have to install a runtime (PRODUCT section 8: setup in 30 minutes). Owner decision D17: v1 ships as a compiled binary and the package name stays open until launch. From TP TD-10.

## Decision
- Bun and TypeScript. Development has no build step: `bun test` and `bun run typecheck` run on `src/`.
- Releases are compiled with `bun build --compile`, one binary per OS. It carries the MCP server (`deputy serve`) and the owner commands (`deputy config`, `deputy secrets`, ADR-008).
- The release build runs the test suite against the compiled binary as well.
- `zod` validates the input of every tool.
- Slices follow ADR-000: `src/<slice>/{domain,application,ports,adapters}` and an `index.ts`. A slice calls another only through its `index.ts`.
- The package name stays open until launch (`deputy` is taken on npm).

## Alternatives
- Run from source with Bun installed by the owner: no build, but a runtime install strains the setup target.
- Node.js: replaces `bun test` and `bun:sqlite` for no gain the product needs.

## Consequences
- Easier: one file to install; no runtime to explain.
- Harder: a release pipeline per OS; paths and SQLite must work inside the binary.
- Watch: a failure that appears only in the compiled binary; Bun's SQLite API on Windows.

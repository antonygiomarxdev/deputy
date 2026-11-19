# ADR-013: The composition root is split by responsibility under `src/main/`

## Status
Accepted (2026-11-19)

## Context
ADR-000 makes `src/main.ts` the only place an adapter is built. By 2026-11-19 it held 270 lines and one 200-line `serve()` function doing ten jobs: reading the environment, opening the database and listing every migration, applying pending owner numbers, choosing the provider, wiring Intake and Drafts, building the listener, the supervisor and its tick, listing the MCP tools, and the shutdown. Each new slice (Orders, Notify, Knowledge, Setup) would add to the same function. Every reason to change Deputy's wiring changes one file, which breaks the single responsibility the rest of the code follows (owner, 2026-11-19).

## Decision
- `src/main.ts` is the entry point only: it reads the command and runs `serve`.
- `src/main/` is the composition root, one file per responsibility. Each file exports the functions that build and return what the next step needs; a file exports two when the start order splits its job into phases (Intake owner numbers are applied before the provider is chosen):
  - `settings.ts`: reads and validates the environment (`DEPUTY_PORT`, `DEPUTY_DATA_DIR`, `DEPUTY_CONFIG_DIR`, `DEPUTY_SECRET_SERVICE`, `DEPUTY_KAPSO_BASE_URL`).
  - `database.ts`: the one ordered list of every slice's migration files (TD-3) and opening the database.
  - `provider.ts`: the dev or Kapso provider for the resolved settings.
  - `intake.ts`: the owner-number commands, the Intake runtime, the scheduler and the listener.
  - `drafts.ts`: Drafts and the approvals.
  - `tools.ts`: the MCP server and its tool list.
  - `lifecycle.ts`: the lease supervisor with its hooks and tick, and the shutdown.
  - `serve.ts`: the start sequence, calling the others in order.
  - A new slice adds its own file (for example `orders.ts`) and one call in `serve.ts`.
- Where ADR-000, the TP and the architecture test say `src/main.ts`, they now mean `src/main.ts` and `src/main/`: only these build an adapter and import `src/composition/`. Only `src/main.ts` imports `src/main/`, and files in `src/main/` may import each other. Nothing else imports either.
- Behavior does not change. The end-to-end tests are the check.

## Alternatives
- Keep one file and split `serve()` into functions: the function shrinks, but the file still changes for every reason.
- Put the wiring in each slice (`createIntakeFromEnv`): a slice would build adapters and read the environment, which ADR-000 keeps out of slices.
- Put it in `src/composition/`: that folder holds the MCP server and the tools that span slices, and builds no adapter; mixing both would blur that rule.

## Consequences
- Easier: each wiring change touches one small file; a new slice adds a file, not 50 lines to one function.
- Harder: the start order now spans files, so `serve.ts` must read as the sequence, top to bottom.

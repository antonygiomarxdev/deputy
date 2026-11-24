# Technical Proposal: Guided flow (Setup FRD-01)

Status: Approved (2026-11-18)

Follows the cross-cutting TP (`docs/tp/TP.md`). "Cross-cutting TD-n" means a decision there. This TP also fixes the Setup domain that TP-02, TP-03 and TP-04 build on.

## Context

Fixed by the cross-cutting TP, so not decided again:
- Setup is one bounded context (`src/setup/{domain,application,ports,adapters}`), aggregate `SetupProgress`, table `setup_progress` in the one SQLite file (TD-0, TD-3).
- The MCP tools `setup_status` and `setup_check` call `GetSetupStatus` and `RunSetupCheck` (TD-1, Interfaces table).
- Setup changes no sensitive setting. It shows the `deputy config set` or `deputy secrets set` command, waits, and reads the applied result back through read-only ports (TD-8, D19).
- Deputy speaks in fixed codes with an English default text. The agent says them in the owner's language (D20). Every instruction, reason and "what to do" in this slice is a code plus an English default text plus numbers. Deputy ships no other language.
- Every use case that writes first asks `OwnerLease` (TD-2). A process that is not the owner reads and writes nothing in Setup (D16).
- Libraries stay behind ports (ADR-000 of the cross-cutting set). This TP uses none in `domain/`, `application/` or `ports/`.

Facts that bind this TP:
- Step 1 must pass before any provider exists, so Deputy runs on the dev provider from the first minute (L1, FR-SETUP-01-11). With no `provider` in `config.json`, Intake resolves to dev (Intake TP-01, `ResolveProviderSettings`, rule 1).
- Agent install commands, checked against current docs on 2026-11-17: Claude Code `claude mcp add --transport stdio --scope user <name> -- <command> [args]` (https://code.claude.com/docs/en/mcp); Codex `codex mcp add <name> -- <command>`, stored in `~/.codex/config.toml` (https://learn.chatgpt.com/docs/extend/mcp?surface=cli); Gemini CLI `gemini mcp add [-s user|project] <name> <command> [args]` (https://geminicli.com/docs/tools/mcp-server/); Cursor has no add command, it reads `~/.cursor/mcp.json` with a top-level `mcpServers` object (https://cursor.com/docs/context/mcp).

Two points where an FRD and the cross-cutting TP need a ruling from the lead (sent to team-lead, not changed here):
1. FR-SETUP-01-7 says the step 3 check is a live probe of the provider, but the provider key is entered only in step 4 (FRD-03). Without the key, nothing can be probed. This TP makes step 3 check the owner's statement plus the applied connection settings, and moves the provider's confirmation and the end of the provider wait to the first passing probe, which runs in step 4 (TD-2 below, TP-02).
2. `GetSetupStatus` is listed as a pure read, but FR-SETUP-01-9 makes it record the first-instruction time. It therefore asks the lease like `ReadInbox`: in the owner process it records, in another process it only reads and says it records nothing.

## Requirements served

FR-SETUP-01-1, FR-SETUP-01-2, FR-SETUP-01-3, FR-SETUP-01-4, FR-SETUP-01-5, FR-SETUP-01-6, FR-SETUP-01-7, FR-SETUP-01-8, FR-SETUP-01-9, FR-SETUP-01-10, FR-SETUP-01-11. Related: FR-SETUP-04-7 (test mode skips steps 2 to 4), FR-SETUP-04-8 (switch).

## Decisions

### TD-1: Where does the current step come from?

- **Option A** Derived. `SetupProgress` stores per step only facts: when it started, when it passed, the last check result. The current step is the first step that is not passed and not skipped. A resume re-runs the checks of the passed steps in order and flips a failed one back to "to do" (FR-SETUP-01-7). Cost: a check per step, and a re-check on every resume. Risk: a live check needs the provider; if it is down the step cannot be judged (handled: the step stays "not passed, retry later", FRD edge case).
- **Option B** A stored pointer `current_step` that advances when a step passes. Cost: one column, no re-check logic. Risk: the pointer is wrong the moment the provider disconnects the number or the key is revoked, and it says "step 5" while step 3 is broken. FR-SETUP-01-7 and the edge case "a step passed earlier fails on resume" cannot be met without re-checking anyway, so Option B needs Option A's checks plus a pointer to keep in step.
- **Option C** Keep the state only in the agent conversation. Cost: none. Risk: the agent restarts mid-step (FRD edge case) and the state is lost; two agents show two states.

Chosen: Option A. It is the only option where the owner's real state (the provider, the key, the config) wins over any claim (FR-SETUP-01-3, "the check wins"). Recorded in ADR-001.

### TD-2: How is time recorded and shown?

The owner can stop for days (FRD edge case), the provider has its own waits, and the optional live-delivery step must be timed apart (FR-SETUP-01-9, FR-SETUP-01-10).

- **Option A** Event rows. Every Setup tool call writes one `setup_activity` row (time). Provider waits are intervals in `setup_provider_wait`. Working time is computed on read: the sum of gaps between consecutive activity rows, each gap capped at 10 minutes, minus the provider wait inside it. Calendar time is last minus first. Cost: a small table and one pure function. Risk: the cap is a rule of thumb (stated below).
- **Option B** Counters. Setup keeps a running "working seconds" number, adding the time since the last call. Cost: no activity table. Risk: the number cannot be recomputed when a rule changes, a crash loses a step's time, and nothing can be audited.
- **Option C** Calendar time only. Cost: nothing to build. Risk: an owner who stops on Monday and finishes on Thursday shows days against a 30-minute target, and the provider's own wait counts against the owner, which FR-SETUP-01-9 forbids.

Chosen: Option A. Facts:
- `firstInstructionAt` is the time Deputy first shows the setup status in the owner process (FR-SETUP-01-9).
- The idle cap is 10 minutes: one third of the 30-minute v1 target (PRODUCT section 8). A longer silence is the owner away, not working.
- Provider wait (kind `connect`) starts when the owner says they asked the provider to connect the number and ends at the first probe that passes with the history sync complete. The end is the time the probe saw it, so it can be late by up to the time until the owner or agent runs the check. The guide tells the agent to run `setup_check` every minute during this wait. The error is bounded by that minute and is stated in the summary as "up to".
- Provider wait (kind `delivery`) starts when the owner says they sent the test message and ends when Intake stored it (its `storedAt`).
- The optional live-delivery step (FRD-02) is kind `live`. It is shown apart and subtracted from the total (FR-SETUP-01-10).
- Total is first instruction to the passing round trip, minus `live` time. The summary shows total working time, total calendar time and provider wait apart.

Recorded in ADR-002.

### TD-3: How does Deputy get into the owner's agent (step 1)?

Agent-agnostic (cross-cutting TD-1: Claude Code, Codex, Cursor, Gemini CLI). How the binary gets onto the machine is outside Setup (PRD open question 6). Step 1 starts after it is there.

- **Option A** `deputy install --agent <name>` edits each agent's configuration file itself (JSON for Claude Code, Cursor and Gemini CLI; TOML for Codex). Cost: a TOML library behind an adapter and four file formats to keep current. Risk: a bad merge corrupts the owner's agent configuration, and every agent release can move the file.
- **Option B** `deputy install --agent <name>` runs the agent's own add command (Claude Code, Codex, Gemini CLI) and merges one JSON entry for Cursor, which has no command. It prints the exact command first, so the owner can run it by hand when the spawn fails. Cost: a small spawn adapter. Risk: on Windows a command installed by npm is a `.cmd` shim, and I did not verify that Bun's spawn runs it; the printed command is the fallback.
- **Option C** Setup only prints the commands and the owner copies them. Cost: nothing. Risk: a non-technical owner pastes a long command wrongly, against the 30-minute target and R-SETUP-4.

Chosen: Option B. The agent's own command is the supported way and keeps the agent's file format its own business. The Cursor merge is plain JSON (`JSON.parse`, add `mcpServers.deputy`, write back), so it needs no library, and a failed parse stops without writing. The server entry is `<absolute path of deputy> serve` with no `provider` set, so Intake resolves to dev (test mode, FR-SETUP-01-11). Scope is user, so Deputy is there in every folder (Claude Code's default scope is the current project only). Recorded in ADR-003.

## Architecture

Moved verbatim to [TP-01-guided-flow-architecture.md](../tp-detail/TP-01-guided-flow-architecture.md).

## Information

Tables owned by Setup (the cross-cutting TP names `setup_progress`; the others hold what a progress row cannot):

```sql
CREATE TABLE setup_run (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  mode                 TEXT NOT NULL CHECK (mode IN ('test','real')),
  agent                TEXT CHECK (agent IN ('claude-code','codex','cursor','gemini-cli','other')),
  first_instruction_at TEXT,                 -- UTC ISO-8601; set once
  completed_at         TEXT,
  superseded_by        INTEGER REFERENCES setup_run(id)
);
CREATE TABLE setup_progress (
  run_id        INTEGER NOT NULL REFERENCES setup_run(id),
  step          TEXT NOT NULL CHECK (step IN ('install','costs','connect','credentials','profile','test')),
  state         TEXT NOT NULL CHECK (state IN ('todo','done','skipped','recheck')),
  started_at    TEXT,
  passed_at     TEXT,
  checked_at    TEXT,
  check_passed  INTEGER CHECK (check_passed IN (0,1)),
  reason_code   TEXT,                        -- fixed code, never provider text (D20)
  reason_params TEXT,                        -- JSON of numbers and fixed names only
  PRIMARY KEY (run_id, step)
);
CREATE TABLE setup_activity (
  run_id INTEGER NOT NULL REFERENCES setup_run(id),
  at     TEXT NOT NULL
);
CREATE TABLE setup_provider_wait (
  run_id     INTEGER NOT NULL REFERENCES setup_run(id),
  kind       TEXT NOT NULL CHECK (kind IN ('connect','delivery','live')),
  started_at TEXT NOT NULL,
  ended_at   TEXT,
  PRIMARY KEY (run_id, kind, started_at)
);
CREATE TABLE setup_fact (                    -- append-only facts of TP-02 to TP-04
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id      INTEGER NOT NULL REFERENCES setup_run(id),
  kind        TEXT NOT NULL,                 -- fixed list in the domain
  at          TEXT NOT NULL,
  value       TEXT,                          -- a code or a short fixed value, never a secret
  owner_words TEXT
);
```

`reason_params` and `value` never hold a secret (TP-03, TD-3 there refuses words that contain one). `state` stores `done` and `todo`; "current" is derived (TD-1). All times are UTC.

## Interfaces

Inbound ports (published in `src/setup/index.ts`):

```ts
interface GetSetupStatus {
  execute(): Promise<SetupStatusView>;       // asks the lease: records first instruction and activity only in the owner process
}
type SetupStatusView = {
  mode: 'test' | 'real';
  steps: { id: StepId; name: string; state: 'done' | 'current' | 'todo' | 'skipped';
           startedAt: Instant | null; passedAt: Instant | null; lastReason: Reason | null }[];
  current: StepId | null;                    // null when complete
  remaining: number;                         // steps after the current one, skipped excluded
  instructions: { code: string; text: string; actor: 'owner' | 'agent'; params: Record<string, string | number> }[];
  recorded: boolean;                         // false in a process that is not the owner
  timing: { firstInstructionAt: Instant | null; workingMs: number; calendarMs: number; providerWaitMs: number } | null;
};
interface RunSetupCheck {
  execute(q: { step?: StepId; seenTools?: string[] }): Promise<
    | { kind: 'passed'; step: StepId; next: StepId | null }
    | { kind: 'failed'; step: StepId; reason: Reason }
    | { kind: 'resumed'; results: { step: StepId; passed: boolean; reason: Reason | null }[]; current: StepId | null }
    | { kind: 'refused'; reason: 'not_owner' }
  >;
}
type Reason = { code: string; text: string; todo: { code: string; text: string }; params: Record<string, string | number> };
```

`RunSetupCheck` with no `step` runs the resume procedure (FR-SETUP-01-7): re-check every passed step in order using its kind (table above), stop at the first failure, return `resumed`. With a `step`, it runs that one step's check; the step passes only when all earlier steps are passed or skipped, else the result is `failed` with `earlier_step_open`. The check of step 1 needs `seenTools`; without it the result is `failed` with `seen_tools_missing`.

MCP tools (names fixed by the cross-cutting TP):

| Tool | Input (zod) | Output | Use case | FRs |
|---|---|---|---|---|
| `setup_status` | none | `SetupStatusView` as text plus structured | `GetSetupStatus` | FR-SETUP-01-1, FR-SETUP-01-2, FR-SETUP-01-8, FR-SETUP-01-9, FR-SETUP-01-10 |
| `setup_check` | `{ step?: StepId, seen_tools?: string[] }` | check result with plain reason and what to do | `RunSetupCheck` | FR-SETUP-01-3, FR-SETUP-01-4, FR-SETUP-01-5, FR-SETUP-01-7 |

Command-line adapter added by this FRD (an inbound adapter in `src/adapters/cli/`, no use case, no lease): `deputy install --agent claude-code|codex|cursor|gemini-cli`. It prints the exact agent command first, then runs it, then prints the result in plain words.

Step 1 text for the agent (the setup guide): "list your tools and pass their names to `setup_check` for step 1; a claim that you are connected does not count".

Reason codes (each has an English text and a "what to do" in `domain/reasons.ts`; the agent says them in the owner's language): `deputy_not_installed`, `tools_missing`, `seen_tools_missing`, `earlier_step_open`, `provider_unreachable`, `usage_limit`, plus the codes of TP-02 to TP-04. A check that cannot run because the provider is down returns `provider_unreachable`, leaves the step not passed and tells the owner to retry later (FRD edge case). No code is built from provider or customer text.

Instruction wording (FR-SETUP-01-8): each instruction is one action, with the on-screen words as fixed params (for example the provider's button name). These names live in the provider adapter's guide table, so a screen rename is one edit and the check that the words match is a launch gate (Open questions).

## Threat model

| Attacker | Attack | What stops it | Accepted |
|---|---|---|---|
| A careless or fooled agent | Says a step is done to skip it | The check wins: each step passes only on its own evidence (TD-1). Step 1 compares tool names to Deputy's own registry | The agent can still invent `seen_tools` that match the registry; step 1 then proves only that the names are right, and the first real tool call proves the rest |
| A customer message | Tries to steer Setup | Setup reads no customer text. Reasons are fixed codes | None |
| An injected agent | Edits the progress to look finished | There is no tool that sets a step passed; only checks and recorded facts do | An agent with a shell can edit the database (D11) |
| Another process | Two sessions record time twice | The lease: only the owner process writes (TD-2); others read | None |

Asset: the setup record holds no secret and no customer text.

## Testing

ATDD (cross-cutting TD-11). Each line is a test titled with its FR id, first written, then the code. Layers: UC = use case with in-memory adapters and a fake clock; AC = adapter contract (in-memory and SQLite repository run the same tests); E2E = server over stdio with the dev provider.

| FR | Test (Given / When / Then) | Layer |
|---|---|---|
| FR-SETUP-01-1 | Given a new owner, When `GetSetupStatus` runs, Then six steps, the current one named, the remaining count 5 and the actor of each instruction | UC |
| FR-SETUP-01-2 | Given any status, When instructions are listed, Then every instruction that involves a terminal command, a password, a code or a payment has actor `owner`; none is `agent` | UC |
| FR-SETUP-01-3 | Given the check of step 3 fails, When the owner asks to go on, Then step 4 does not start and its check refuses with `earlier_step_open` | UC |
| FR-SETUP-01-4 | Given each reason code, When it is rendered, Then it has an English text and a "what to do" and the text is not an error message of a library | UC |
| FR-SETUP-01-5 | Given Deputy's tools are not in `seenTools`, When step 1 is checked, Then it fails with `deputy_not_installed`; given a partial list, it fails with `tools_missing` naming them; given the full list, it passes. Given the agent only claims it is connected, no check passes | UC |
| FR-SETUP-01-6 | Given steps 1 to 3 passed, When the process restarts, Then the repository returns the same passed steps with their times | AC |
| FR-SETUP-01-7 | Given steps 1 to 5 passed and the number was disconnected, When the owner resumes, Then step 1 is checked live, step 2 uses its stored result, step 3 reads the config live, step 6 is not run, and step 3 returns to `todo` with the reason | UC |
| FR-SETUP-01-8 | Given the instruction table, When it is read, Then each entry holds one action and a provider screen word is a param, not free text | UC |
| FR-SETUP-01-9 | Given a test clock, When the owner says they asked the provider to connect and the first passing probe is 6 minutes later, Then the connect wait is 6 minutes; given the first status in a non-owner process, Then nothing is recorded and `recorded` is false | UC |
| FR-SETUP-01-10 | Given a run whose provider wait was 6 minutes and whose live-delivery step took 4, When the test passes, Then the summary shows total, working time, calendar time, 6 minutes of wait apart, and the 4 minutes are not in the total. Given the owner stopped for 2 days, Then working time stays small and calendar time shows days | UC |
| FR-SETUP-01-11 | Given Deputy installed and nothing else done, When the status is read, Then step 1 is current in mode `test` and `ConnectionConfigReader` shows no provider (dev); given step 3 passes, Then config reads `kapso` | UC and E2E |

Install adapter: a fake agent command that records its arguments (Claude Code, Codex, Gemini CLI) and a temp `mcp.json` (Cursor): the printed command is the exact one run; a corrupt JSON file is left untouched. The Windows `.cmd` spawn is a launch-gate live check (Risks).

## Risks

| Risk | Effect | Mitigation |
|---|---|---|
| The provider wait end is the time a probe saw the connection, not the provider's own time | Wait shown up to one check interval late | The guide asks for a check every minute; the summary says "up to" |
| The idle cap of 10 minutes is a rule of thumb | Working time is an estimate | It is a domain constant with a test; the calendar time is exact |
| Agent add commands change between releases | Install fails | The command is printed first, so the owner can run it by hand; one live check per agent before launch |
| Windows `.cmd` shims for npm-installed agents | The spawn fails | Printed fallback; a live check on Windows with Codex |
| The agent lists tool names with a prefix (for example `mcp__deputy__inbox`) | Step 1 fails wrongly | The check matches a registry name as a whole suffix after the last `__` or `.`; tested with three prefix styles |

## Open questions

1. Languages at launch (FRD-01 open question 1): by D20, Deputy ships English codes and the agent speaks the owner's language, so the answer is "any the agent speaks". The owner should confirm.
2. A "run a check now" command outside the first run (FRD-01 open question 2): `setup_check` with no step already does it and works at any time. The owner should confirm that is enough.
3. How the package reaches the machine (FRD-01 open question 3): out of Setup (PRD open question 6). `deputy install` assumes the binary exists.
4. The on-screen words of the provider's pages are verified by hand before each release. Who keeps that list current?

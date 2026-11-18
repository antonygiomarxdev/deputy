# ADR-009: Setup shows a deny rule for the agent and never writes it

## Status
Proposed

## Context
FR-SETUP-03-2: the agent must not read the secrets, and with an agent other than the locked-down profile (removed by the cross-cutting TD-9) the owner must restrict the path. FR-SETUP-03-7: Setup changes no setting of the agent that loosens approval. From Setup TP-03, TD-2.

## Decision
Setup shows the owner a deny rule and says what it does not cover. For Claude Code it is `permissions.deny: ["Read(~/.deputy/**)"]`; the path syntax and the scope are in https://code.claude.com/docs/en/permissions (Read and Edit deny rules cover the built-in file tools and file commands Claude Code recognizes in Bash, not an arbitrary script that opens the file; the sandbox is the OS-level option). For Codex, Cursor and Gemini CLI no verified rule syntax was found, so Setup tells the owner in plain words to restrict `~/.deputy` in the agent's permission settings and says Deputy cannot verify it. The OS credential store keeps the secrets out of the folder in the normal case.

## Alternatives
- `deputy install` writes the rule into the agent's settings: it edits the agent's permission file, which Setup stays away from, and a bad merge could disable the owner's other rules.
- Nothing: the fallback file and `config.json` stay readable by an agent's file tools.

## Consequences
- Easier: protection without Setup touching the agent's permissions.
- Harder: the owner must paste a rule; it can be skipped.
- Watch: an agent with a shell can still read the files (D11); add verified syntax for the other agents when found.

# SPEC-05-15: The install guide installs the agents, the flag and the allow rule

Status: Draft
Rests on: ../frd/FRD-05-pilot-setup.md

## Summary

The install guide copies the three agent files into the project's agents folder, makes the shortcut start the session as the dispatcher with the wake option, adds the explicit allow rule for the send-answer tool, and orders its steps so that the owner trusts the folder before the rules take effect.

Last change: 2026-11-24, first draft for the dispatcher session

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-SETUP-05-43 | WHEN | WHEN the install guide finishes, the agent definitions of the dispatcher, the triage helper and the web helper shall be installed as plain files in the project's agents folder. (Proposed, lead decision.) |
| FR-SETUP-05-44 | WHEN | WHEN the owner uses the shortcut, the session shall start as the dispatcher with the wake option (ADR-018, ADR-019). (Proposed, lead decision.) |
| FR-SETUP-05-45 | WHEN | WHEN the install guide writes the permission rules, it shall also allow the send-answer tool for helpers, and it shall do so only after the project folder is trusted, so the install steps are ordered that way. (Proposed, lead decision.) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| INSTALL.md | Create (SPEC-05-1 creates it; this spec adds the steps) | the new steps and their order |
| test/docs/install-guide.test.ts | Create (SPEC-05-1 creates it; this spec adds the cases) | asserts the new rows |

## Reuses
- Precedent: SPEC-05-1-install-guide.md, the guide and its test this spec extends
- Precedent: SPEC-05-13-dispatcher-agent.md and SPEC-05-14-helper-agents.md, the files the guide copies

## Tests first
FR-SETUP-05-43, FR-SETUP-05-44, FR-SETUP-05-45, written before the code, without it in view, by reading INSTALL.md. FR-SETUP-05-43: a step copies `deputy-dispatcher.md`, `deputy-triage.md` and `deputy-web.md` into the project's agents folder and has a Check line. FR-SETUP-05-44: the shortcut command holds `--agent deputy-dispatcher` and the wake flag of ADR-018. FR-SETUP-05-45: the permission rules written hold `mcp__deputy__send_answer` next to `mcp__deputy__*` and the deny entries; a step named as the owner's own action opens the folder once in the agent and accepts the trust prompt, and it comes before the step that writes the rules.

## Build
```ts
export const AGENT_FLAG = "--agent deputy-dispatcher";
export const PERMISSIONS = { permissions: { allow: ["mcp__deputy__*", "mcp__deputy__send_answer"], deny: ["Bash", "PowerShell"] } };
```
Order: prerequisites, get the code, install, register the server, copy the skill, copy the agents, the owner trusts the folder, write PERMISSIONS, create the shortcut.

## Done when
`bun test test/docs/install-guide.test.ts`

## Out of scope
The agent files (SPEC-05-13, SPEC-05-14); the first launch consent dialog (the guide of SPEC-05-1 and the first-message spec).

## Open questions
None. `mcp__deputy__*` already allows the send-answer tool, so the explicit entry is redundant and harmless; the trust-before-rules order is the researcher's finding and is unverified here.

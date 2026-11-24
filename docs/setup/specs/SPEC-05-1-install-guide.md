# SPEC-05-1: the install guide the agent follows once

Status: Draft
Rests on: ../frd/FRD-05-pilot-setup.md

## Summary

Write INSTALL.md, the guide the agent follows once when the owner asks it to install Deputy from a link, and a test that reads it. One section per system, a check after every step, the permission rules and the launch shortcut.

Last change: 2026-11-24, first draft for the pilot

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-SETUP-05-1 | WHEN | WHEN the owner asks the agent to install Deputy from a link, the agent shall follow the install guide once, say what each step does before it runs it, and check that the step worked. |
| FR-SETUP-05-2 | always | The install guide shall cover Windows, macOS and Linux and shall name the owner's own action wherever a step cannot be done by the agent. |
| FR-SETUP-05-3 | WHEN | WHEN the install guide finishes, the project's permission rules shall allow only Deputy's own tools and deny the shell tools (ADR-018). |
| FR-SETUP-05-4 | WHEN | WHEN the install guide finishes, the owner shall have a shortcut that opens the agent session with the wake option (ADR-018), and the guide shall tell the owner to use it. |
| FR-SETUP-05-36 | WHEN | WHEN the install guide has created the shortcut, the agent shall run it once while the owner is present, so that the consent dialog of the wake option is answered during setup and never meets the daily loop. |
| FR-SETUP-05-37 | WHEN | WHEN the owner asks the agent to install Deputy from a link, the install guide shall first check that the runtime Deputy needs, git and the agent are present, and say what to install when one is missing. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| INSTALL.md | Create | the guide: steps, a Check line per step, one section each for Windows, macOS and Linux |
| test/docs/install-guide.test.ts | Create | reads INSTALL.md and asserts the rows |

## Reuses
- `README.md` `claude mcp add`: the install command the guide repeats, with `DEPUTY_DATA_DIR` set to an absolute path.
- `docs/adr/ADR-018-wake-and-permissions.md` `mcp__deputy__*`: the exact permission rules and the wake option the guide writes.

## Tests first
FR-SETUP-05-1: every step has a line that says what it does and a line that starts with "Check:". FR-SETUP-05-2: headings for Windows, macOS and Linux, and each names the owner's own actions. FR-SETUP-05-3: the guide holds the permission rules of ADR-018 exactly. FR-SETUP-05-4: the guide creates a shortcut that runs the agent with the wake option of ADR-018. FR-SETUP-05-36: the guide's last step runs the shortcut once with the owner present and names the consent dialog the owner will see. FR-SETUP-05-37: the guide's first step checks the runtime, git and the agent and says what to install if one is missing.

## Build
```ts
const guide = readFileSync("INSTALL.md", "utf8");
export const PERMISSIONS = { permissions: { allow: ["mcp__deputy__*"], deny: ["Bash", "PowerShell"] } };
export const WAKE_FLAG = "--dangerously-load-development-channels server:deputy";
```
The guide steps, in order: check the prerequisites (the runtime, git, the agent), get the code, install its dependencies, register the server with an absolute data folder, copy the skill, write PERMISSIONS to the project settings, create the shortcut that runs the agent with WAKE_FLAG, run it once with the owner present.

## Done when
`bun test test/docs/install-guide.test.ts`

## Out of scope
- The key page and the key: SPEC-05-2. The skill file the guide copies: SPEC-05-7.
- Other agents and the compiled binary: not in the pilot.

## Open questions
None.

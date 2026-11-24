# SPEC-05-6: keep the computer awake while a session is open

Status: Draft
Rests on: ../frd/FRD-05-pilot-setup.md

## Summary

A small adapter that holds an operating system keep-awake while Deputy runs as the owner process, without administrator rights, and releases it on exit. A failure to start is reported once.

Last change: 2026-11-24, first draft for the pilot

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-SETUP-05-15 | WHILE | WHILE a session is open, Deputy shall keep the computer from sleeping through idleness, without administrator rights, and shall release that hold when the session ends (D36). |
| FR-SETUP-05-16 | IF | IF the keep-awake hold cannot be started, THEN Deputy shall say so once and keep working. |
| EX-8 | RULE-4 | positive | A session is open | Deputy starts | The keep-awake hold is on |
| EX-9 | RULE-4 | boundary | A session is open with the hold on | The session ends | The hold is released |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/adapters/power/keep-awake.ts | Create | `createKeepAwake` with one method per system |
| src/main/lifecycle.ts | Change | start on `onAcquired`, stop on `onLost` and on shutdown |
| test/adapters/power/keep-awake.test.ts | Create | fake process spawner per platform |

## Reuses
- `src/main/lifecycle.ts` `superviseLease`: the owner hooks that start and stop the hold.
- `src/adapters/supervisor/lease-supervisor.ts` `onAcquired`: the hook that fires when this process becomes the owner process.

## Tests first
FR-SETUP-05-15: on macOS the spawned command is the idle-sleep hold tied to the process id; on Linux the inhibitor tied to the process id; on Windows `setExecutionState` is called once with 0x80000001 and with 0x80000000 on `stop()`, and when it throws the PowerShell child process that ends with Deputy is used instead; `stop()` kills the child; a second `start()` does nothing. FR-SETUP-05-16: when the spawner throws, `log` receives one message and `start()` returns normally. EX-8: `start()` spawns the hold once. EX-9: `stop()` kills the hold and a later `stop()` does nothing.

## Build
```ts
export interface KeepAwake { start(): void; stop(): void }
export function createKeepAwake(d: {
  platform: string;
  pid: number;
  spawn(cmd: string[]): { kill(): void };
  setExecutionState(flags: number): number;
  log(message: string): void;
}): KeepAwake;
```
On macOS and Linux the hold is a child process that ends when this process ends. On Windows Deputy calls `SetThreadExecutionState(0x80000001)` on the main thread through the runtime's foreign-function module on kernel32.dll, and clears it with 0x80000000 or by exiting; it needs no administrator rights and does not override the lid or the power button (L12). The default `setExecutionState` is that binding.

## Done when
`bun test test/adapters/power/keep-awake.test.ts`

## Out of scope
- The checklist text for the owner: SPEC-05-7. A hold that beats a closed lid: not possible without administrator rights, so not built.

## Open questions
None. The Windows call is recorded as L12 (source: learn.microsoft.com, SetThreadExecutionState).

# SPEC-08-4: `deputy secrets set <name>` stores a secret without echo

Status: Draft
Rests on: ../../adr/ADR-008-secrets-and-configuration.md

## Summary

`deputy secrets set <name>` prompts for the value without echo, stores it in the OS credential store, and prints no value. When the store throws it writes `~/.deputy/secrets.env` instead and says so and why. The value lives in one place only.

Last change: 2026-11-24, first draft from ADR-008

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

- Secrets (provider key, webhook secret, Google service account path) live in the OS credential store through `Bun.secrets` (macOS Keychain, libsecret on Linux, Windows Credential Manager; service `deputy`, one entry per secret). Source: https://bun.com/docs/runtime/secrets. I checked on Windows 11 with Bun 1.4.4 that `set`, `get` and `delete` work from source and from a `bun build --compile` binary. I did not check macOS or Linux; the docs say a secret service must be running on Linux and do not say what happens without one, and a third-party report (NixOS discourse, Proton Drive CLI thread) shows a compiled Bun binary failing with `libsecret not available`. The owner writes a secret with `deputy secrets set <name>`, which prompts without echo and prints no value.
- Fallback: when `Bun.secrets` throws for any reason, the command writes `~/.deputy/secrets.env` (`KEY=value`, mode 0600 on POSIX), outside the repo and the agent's project, and says so and why. Reads try the store, then the file. A value lives in one place only. `check_secrets` says where each one is, never the value.

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/adapters/cli/secrets.ts` | Create | `runSecrets`: `set`, the store call and the file fallback |
| `src/main.ts` | Change | sends the command `secrets` to `runSecrets` |
| `test/adapters/cli/secrets-set.test.ts` | Create | the tests below |

## Reuses
- `src/adapters/secrets/secret-store.ts` `createSecretStore`: reads the OS store first, then `secrets.env`; the writer must agree with its file format (`name=value` lines)
- `src/main/connection.ts` `Bun.secrets`: the call the reader already makes, under the service name

## Tests first
The rows above carry no ids, so the tests cite none. Written before the code, without it in view, with a fake store: (1) a store that works receives `{ service: "deputy", name, value }` and the output holds no value; (2) a store that throws makes the command write `secrets.env` with `name=value`, and say so and why; (3) after a write to the file the store holds no copy, and after a write to the store the file holds none; (4) on POSIX the file mode is 0600.

## Build
```ts
export async function runSecrets(argv: string[], d: { os: { set(service: string, name: string, value: string): Promise<void>; delete(service: string, name: string): Promise<void> }; configDir: string; readSecret: () => Promise<string>; out: (s: string) => void }): Promise<number>;
```
`runSecrets(["set", name])` reads the value with `readSecret`, tries `os.set`, falls back to the file on any throw, and returns 0.

## Done when
`bun test test/adapters/cli/secrets-set.test.ts`

## Out of scope
`secrets list` (SPEC-08-5). Reading secrets back is the reader that exists. `check_secrets` and the mode warning at start belong to Setup.

## Open questions
- Q-1 (Lead): which names `set` accepts. The ADR names `kapso-api-key` and `kapso-webhook-secret`, and a Google service account path without a name.
- Q-2 (Lead): how the prompt reads without echo on Windows and on POSIX, and what `set` does when stdin is not a terminal.
- Q-3 (Lead): the text the command prints, and the exit codes.

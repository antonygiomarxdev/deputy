# SPEC-08-4: `deputy secrets set <name>` stores a secret without echo

Status: Draft
Rests on: ../../adr/ADR-008-secrets-and-configuration.md

## Summary

`deputy secrets set <name>` reads the value without echo, stores it in the OS credential store, and prints no value. When the store throws it writes `~/.deputy/secrets.env` instead and says so and why. The value lives in one place only, and never comes from the command line arguments.

Last change: 2026-11-24, answers of the lead folded in

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

- Secrets (provider key, webhook secret, Google service account path) live in the OS credential store through `Bun.secrets` (macOS Keychain, libsecret on Linux, Windows Credential Manager; service `deputy`, one entry per secret). Source: https://bun.com/docs/runtime/secrets. I checked on Windows 11 with Bun 1.4.4 that `set`, `get` and `delete` work from source and from a `bun build --compile` binary. I did not check macOS or Linux; the docs say a secret service must be running on Linux and do not say what happens without one, and a third-party report (NixOS discourse, Proton Drive CLI thread) shows a compiled Bun binary failing with `libsecret not available`. The owner writes a secret with `deputy secrets set <name>`, which prompts without echo and prints no value.
- Fallback: when `Bun.secrets` throws for any reason, the command writes `~/.deputy/secrets.env` (`KEY=value`, mode 0600 on POSIX), outside the repo and the agent's project, and says so and why. Reads try the store, then the file. A value lives in one place only. `check_secrets` says where each one is, never the value.

R1 is the first row above, R2 the second. The ADR has no row ids, so these labels are local to the spec.

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/adapters/cli/secrets.ts` | Create | `runSecrets`: `set`, the store call, the file fallback and the prompt |
| `src/main.ts` | Change | sends the command `secrets` to `runSecrets` |
| `test/adapters/cli/secrets-set.test.ts` | Create | the tests below |

## Reuses
- `src/adapters/secrets/secret-store.ts` `createSecretStore`: reads the OS store first, then `secrets.env` (`name=value` lines); the writer must agree with that format
- `src/main/connection.ts` `Bun.secrets`: the call the reader already makes, under the service name
- Precedent: SPEC-08-1-config-set-business-number.md, the messages and the exit codes

## Tests first
Written before the code, without it in view, with a fake store. R1: (1) a store that works receives `{ service: "deputy", name, value }` and the output holds no value; (2) a store that throws makes the command write `secrets.env` with `name=value`, mode 0600 on POSIX, and print that the value is in a file and why; (3) after a write to the file the store holds no copy, and after a write to the store the file holds none. R2: (4) a value given as an argument returns 1, writes nothing and stores no value anywhere; (5) a name that is not `kapso-api-key` or `kapso-webhook-secret` returns 1; (6) a storage error returns 2; (7) no pending-change row is written.

## Build
```ts
export const SECRET_NAMES = ["kapso-api-key", "kapso-webhook-secret"] as const;
export async function runSecrets(args: string[], d: { os: { set(service: string, name: string, value: string): Promise<void>; delete(service: string, name: string): Promise<void> }; configDir: string; readSecret: () => Promise<string>; out: (s: string) => void }): Promise<number>;
```
`readSecret`, on a terminal, reads one line through readline with the output muted; off a terminal it reads one line from stdin. `runSecrets(["set", name])` reads the value, tries `os.set`, falls back to the file on any throw, prints one line saying where the value is kept and never the value, and returns 0.

## Done when
`bun test test/adapters/cli/secrets-set.test.ts`

## Out of scope
`secrets list` (SPEC-08-5). Reading secrets back is the reader that exists. `check_secrets` and the mode warning at start belong to Setup.

## Open questions
- Q-1 (Lead): the name of the Google service account path secret. ADR-008 lists it, and no document gives its name, so `SECRET_NAMES` holds only the two Kapso names.

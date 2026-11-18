# ADR-008: Sensitive settings and secrets change only from the owner's terminal

## Status
Proposed

## Context
D6: the owner enters secrets outside the agent conversation. FR-SETUP-03-1 and FR-SETUP-03-4: the agent never holds a secret and sees only a partial echo. Some settings change trust boundaries: `provider = dev` opens unsigned test entry points, and the owner numbers decide which messages count as the owner's. Today secrets sit in `.env` inside the repo. From TP TD-8.

## Decision
- Secrets (provider key, webhook secret, Google service account path) live in the OS credential store through `Bun.secrets` (macOS Keychain, libsecret on Linux, Windows Credential Manager; service `deputy`, one entry per secret). Source: https://bun.com/docs/runtime/secrets. I checked on Windows 11 with Bun 1.4.4 that `set`, `get` and `delete` work from source and from a `bun build --compile` binary. I did not check macOS or Linux; the docs say a secret service must be running on Linux and do not say what happens without one, and a third-party report (NixOS discourse, Proton Drive CLI thread) shows a compiled Bun binary failing with `libsecret not available`. The owner writes a secret with `deputy secrets set <name>`, which prompts without echo and prints no value.
- Fallback: when `Bun.secrets` throws for any reason, the command writes `~/.deputy/secrets.env` (`KEY=value`, mode 0600 on POSIX), outside the repo and the agent's project, and says so and why. Reads try the store, then the file. A value lives in one place only. `check_secrets` says where each one is, never the value.
- Connection settings (`provider`, `receiving_mode`, `push_on`, `business-number`, `kapso-phone-number-id`, `orders-spreadsheet`, `catalog-store sheet:<id>`) and the owner numbers are changed only with `deputy config set <key> <value>`; an owner number is removed with `deputy config remove owner-number <number>`, a pending change applied and logged like `set`. `deputy secrets list` shows each secret's name and where it is kept, never a value. They live in `~/.deputy/config.json` and the owner-numbers repository. No MCP tool changes them; `set_setting` refuses them and names the command.
- The command line is an inbound adapter (`src/adapters/cli/`) that never calls a lease-guarded use case. It writes a `pending_changes` row (key, value, typed command, time) or the config or secrets file, and exits; neither needs the lease. The owner process applies pending changes on its next tick without a restart (Intake's `ApplyPendingChanges` logs each owner-number change with the typed command, L4; the `LeaseSupervisor` re-reads `config.json`). With no owner process, they are applied at the next start. The agent conversation never sees the command line.
- Setup leads without changing anything: it asks which provider and receiving mode the owner wants, explains the difference, shows the exact command and waits. After the owner runs it, Setup reads the applied result back through read-only ports (`ConnectionConfigReader`, `OwnerNumbersReader`) and confirms. This meets FR-SETUP-01-11, FR-SETUP-02-8 and FR-SETUP-02-13: Setup leads, the owner's own command makes the change.
- The read-only tool `list_owner_numbers` (Intake `GetOwnerNumbers`, with the log of typed commands) lets the owner check which numbers count as the owner's (L4).
- `check_secrets` reports present and accepted, and the last four characters of long secrets, never a value. Accepted means: the provider key passes one cheap authenticated call through Intake's `CheckProviderAccess`; the Google account fetches a token and reads the sheet; the webhook secret is present and well formed, and only a signed live-delivery test proves it.
- Deputy checks the secrets file mode at start on POSIX, when the file is in use, and warns if looser than owner-only.
- Setup asks the owner's country (it is the default region for typed phone numbers, Intake ADR-012, and the source of the suggested currency, D21). It is stored as Intake's `country` setting, which is not a trust boundary. The business number is read from the provider when it offers it; otherwise the owner types it with `+` and the country code.
- Other owner-changeable settings live in the database, one owning slice per key (Intake: catch-up period; Inbox: window; Notify: batch, reminder, quiet periods, time zone, notices; Orders: orders store; Knowledge: catalog store). `set_setting` routes by key.
- Known limit: an agent with file tools cannot read the OS store, but an agent with a shell runs as the same user and could read the store or the fallback file, or run the commands (D11). Setup suggests a deny rule and refuses to loosen the agent's permissions (FR-SETUP-03-7).

## Alternatives
- Hand-edited files: a poor fit for the 30-minute target; a wrong mode goes unnoticed.
- The OS credential store as the only store (the first proposal rejected it because it needed a native dependency and Bun had no API; both facts are outdated): it fails on a headless Linux machine or container with no secret service, which would leave the owner with no way to store a key. It is the primary store here, with the file as the fallback.
- The file only: a process that reads files as the user, a backup or a stray commit exposes the keys in plain text, which the store avoids on the machines where it works.
- Sensitive settings through a tool with the owner's words: an injected agent could invent the words.

## Consequences
- Easier: secrets never enter a chat or the repo; trust-boundary settings cannot be changed through Deputy's tools.
- Harder: Setup steps for provider, receiving mode and owner numbers become "You do this" terminal commands; Windows permissions need care.
- Watch: the file-tools and shell limit (D11); a leaked webhook secret lets forged live messages through until replaced.

# ADR-008: Sensitive settings and secrets change only from the owner's terminal

## Status
Proposed

## Context
D6: the owner enters secrets outside the agent conversation. FR-SETUP-03-1 and FR-SETUP-03-4: the agent never holds a secret and sees only a partial echo. Some settings change trust boundaries: `provider = dev` opens unsigned test entry points, and the owner numbers decide which messages count as the owner's. Today secrets sit in `.env` inside the repo. From TP TD-8.

## Decision
- Secrets (provider key, webhook secret, Google service account path) live in `~/.deputy/secrets.env`, outside the repo and the agent's project. The owner writes them with `deputy secrets set <name>`, which prompts without echo, writes owner-only and prints no value.
- Connection settings (`provider`, `receiving_mode`, `push_on`, `business-number`, `kapso-phone-number-id`) and the owner numbers are changed only with `deputy config set <key> <value>`. They live in `~/.deputy/config.json` and the owner-numbers repository. No MCP tool changes them; `set_setting` refuses them and names the command.
- The command line is an inbound adapter (`src/adapters/cli/`) that never calls a lease-guarded use case. It writes a `pending_changes` row (key, value, typed command, time) or the config or secrets file, and exits; neither needs the lease. The owner process applies pending changes on its next tick without a restart (Intake's `ApplyPendingChanges` logs each owner-number change with the typed command, L4; the `LeaseSupervisor` re-reads `config.json`). With no owner process, they are applied at the next start. The agent conversation never sees the command line.
- Setup leads without changing anything: it asks which provider and receiving mode the owner wants, explains the difference, shows the exact command and waits. After the owner runs it, Setup reads the applied result back through read-only ports (`ConnectionConfigReader`, `OwnerNumbersReader`) and confirms. This meets FR-SETUP-01-11, FR-SETUP-02-8 and FR-SETUP-02-13: Setup leads, the owner's own command makes the change.
- The read-only tool `list_owner_numbers` (Intake `GetOwnerNumbers`, with the log of typed commands) lets the owner check which numbers count as the owner's (L4).
- `check_secrets` reports present and accepted, and the last four characters of long secrets, never a value. Accepted means: the provider key passes one cheap authenticated call through Intake's `CheckProviderAccess`; the Google account fetches a token and reads the sheet; the webhook secret is present and well formed, and only a signed live-delivery test proves it.
- Deputy checks the secrets file mode at start on POSIX and warns if looser than owner-only.
- Other owner-changeable settings live in the database, one owning slice per key (Intake: catch-up period; Inbox: window; Notify: batch, reminder, quiet periods, time zone, notices; Orders: orders store; Knowledge: catalog store). `set_setting` routes by key.
- Known limit: an agent with file tools or a shell could read the files or run the commands. Setup suggests a deny rule and refuses to loosen the agent's permissions (FR-SETUP-03-7).

## Alternatives
- Hand-edited files: a poor fit for the 30-minute target; a wrong mode goes unnoticed.
- The OS keychain: a native dependency per OS and a hard step for a non-technical owner.
- Sensitive settings through a tool with the owner's words: an injected agent could invent the words.

## Consequences
- Easier: secrets never enter a chat or the repo; trust-boundary settings cannot be changed through Deputy's tools.
- Harder: Setup steps for provider, receiving mode and owner numbers become "You do this" terminal commands; Windows permissions need care.
- Watch: the file-tools and shell limit (D11); a leaked webhook secret lets forged live messages through until replaced.

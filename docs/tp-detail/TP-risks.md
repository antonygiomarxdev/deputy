# TP: Risks

Part of [TP.md](../tp/TP.md). Moved verbatim from there; nothing changed.

## Risks

| Risk | Effect | Mitigation |
|---|---|---|
| Claude Code's 30-minute stdio idle timeout (`CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT`) may apply to an idle server with only a timer. Unverified (`agents.md` Q3). | The server could be closed while the owner is away from the keyboard; catch-up stops. | Catch-up at every start already covers the gap (FR-INTAKE-03-1). Test it in a live session before launch, first on Claude Code, then Codex (D18); if it applies, document the setting. |
| `instructions` support and size differ by client; Codex keeps the first 512 characters; Cursor and VS Code are not stated. | The rules may not reach the agent. | Rules also in tool descriptions; first 512 characters self-contained; `setup_check` step 1 lists tools (FR-SETUP-01-5). |
| The development-channels flag and the channel contract may change; protocol revision 2026-07-28 may disable channel registration on the v2 runtime. | Push (UC-3) may break. | Push is optional and behind `push_on`; pull is the core (principle 4). |
| Kapso: Coexistence is "less stable"; the free-plan limit of 100 requests per minute; the webhook event for echoes is unconfirmed; whether an owner echo updates a conversation's `last_active` is unverified. | Missed or late echoes; held sends. | Deputy does not depend on it: sweep 2 lists the number's outbound messages directly, and the overlap window absorbs lag. One live check of `last_active` on an echo before launch (a launch gate). |
| An echo may arrive late, after a send. | Deputy could answer after the owner (breaks principle 2). | Catch-up for the chat runs just before every send (FR-DRAFTS-03-1); the remaining window is one provider lag. Accepted. |
| A crash between "mark used" and the provider call. | A draft shows "outcome unknown" though nothing was sent. | Conservative by design: the owner decides (FR-DRAFTS-03-8). |
| A long reply is split into parts (`splitText`, 4000 UTF-16 code units, cut on grapheme boundaries; the WhatsApp limit is 4096 characters); one part may fail. | Partial delivery. | Treat any partial failure as "outcome unknown" and tell the owner which part failed. |
| WhatsApp ids differ from dialled numbers in some countries (Argentina `9` after `54`, Mexico `1` after `52`, Brazil's ninth digit); the sources are third-party apart from one Meta sentence. | An owner's own replies look like customer messages, and Deputy could answer after the owner. | Line keys per country (Intake ADR-012) with AR, MX and BR tests. Launch gate: a live check of the Kapso echo sender format. |
| `Bun.secrets` is experimental and needs a secret service on Linux; it failed in a third-party report as `libsecret not available`. | The OS store may be unavailable. | The file fallback with the mode check; `check_secrets` shows where each secret is. Live check on a Linux container without a secret service before launch (I could not run it). |
| A migration fails or the binary is older than the database. | Data loss or damage by an old binary. | One transaction for all pending migrations, a backup copy before the change, and refusal to open a newer schema (TD-3). |
| Order scrub (L6) conflicts with an immutable log. | The log is not strictly append-only. | One named function, driven by an idempotent handler of the `OrderDeleted` event; Orders re-sends pending outbox rows at start; recorded in ADR-003. |
| A blocked or suspended owner process (laptop sleep) loses the lease. | The next process takes over; the old one is read-only on wake. | The send transaction re-checks the lease token; the supervisor stops its scheduler and listener. |
| A catch-up and a send overlap. | Deputy's own echo is stored before the send is recorded. | Single-flight catch-up; `SendText` stores by an upsert on the provider id, so the message is reclassified, not duplicated. |
| A crash between "approval used" and the order record. | An order approved but not recorded. | `RecordOrder` is idempotent on `installId:draftNumber`; a draft left "recording" is re-driven at start; an `outcome_unknown` answer leaves the draft "unknown" until the owner says so. |
| Windows: no tmux; process end is by closing stdin. | `scripts/start.sh` does not run. | Cleanup on stdin close; Deputy needs no wrapper script. |
| A binary database is not readable by the owner. | Less transparency. | Exports and the log tools. |

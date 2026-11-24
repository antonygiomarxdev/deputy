# TP: architecture

Part of [TP.md](../tp/TP.md). Moved verbatim from there; nothing changed.

## Architecture

(after the diagram)

Folders per slice (`src/<slice>/`):

| Folder | Holds | May import |
|---|---|---|
| `domain/` | entities, value objects, domain services, domain events. No I/O, no framework. | `domain/`, `src/shared/` |
| `application/` | use cases (one class or function each). | `domain/`, `ports/`, `src/shared/` |
| `ports/` | inbound ports (use-case interfaces) and outbound ports (repositories, provider, clock, notifier). Interfaces and plain types only. | `domain/`, `src/shared/` |
| `adapters/` | implementations of the outbound ports, and the translation to other slices' published ports. | all of the slice; other slices' `index.ts` only |
| `index.ts` | the slice's published surface: inbound port types, event types, and a factory for the use cases. | the slice |

Shared kernel `src/shared/` holds only small value objects every slice needs (`ChatId`, `MessageId`, `Source`, `OwnerWords`), the `Clock` port (`now()` and `sleep(ms)`; use cases never call `setTimeout`) and the `OwnerLease` port, the small cross-slice signals in `src/shared/signals.ts` (`SendNeedsOwner`, `OwnerReplyUnlinked`; L8), and three shared functions: `normalizeText`, used by Intake (to store `text_norm`) and Drafts (to compare); `wholeNumberTokens`, next to it, the whole-number rule for the owner's words, used by Drafts and Knowledge so the two cannot drift; and `foldName`, also next to it, Knowledge's name-folding rule (NFKC, lower case, and removal of the combining marks that follow a Latin, Greek, Cyrillic, Arabic or Hebrew letter; Devanagari marks are kept because there a mark changes the word), used by Knowledge's catalog names and references and by Orders' identification guard. `normalizeText` is unchanged. It has no behavior beyond validation and normalization (FR-INTAKE-04-14).

Adapters:

- Inbound: the command line (`deputy config set`, `deputy config remove`, `deputy secrets set`, `deputy secrets list`; it writes a pending-change row or the config and secrets files and calls no use case; the agent never sees it), the MCP server (`src/composition/mcp/`, L8; it validates input with zod and maps each tool to a use case of some slice; each slice defines its own tools in `src/<slice>/adapters/mcp/` with the shared `ToolDefinition` type from `src/adapters/mcp/tool.ts`; every tool that shows customer-derived text uses one helper, `src/adapters/mcp/customer-text.ts`, which escapes `&`, `<` and `>` and wraps the text in its label, so `get_chat`, `list_drafts` and the Inbox tools cannot differ), the live-delivery HTTP listener, and the scheduler (catch-up timer, notice timer).
- Outbound: Kapso and dev providers, SQLite repositories, owner files (profile Markdown, catalog table), spreadsheet (both spreadsheet adapters use the one Google client in `src/adapters/google/`), Claude channel notifier, the lease row (the `OwnerLease` adapter).
- Cross-slice calls: the consumer defines an outbound port in its own `ports/` (for example Inbox's `DraftsQuery`). An adapter in the consumer's `adapters/` implements it by calling the other slice's published inbound port. The domain of one slice never sees another's types.
- Domain events: Intake publishes `MessageStored` (with source and history flag) and `CatchUpFinished`; Orders publishes `OrderDeleted` through its outbox. Notify subscribes through its outbound port `WaitingCounts` and an event subscription wired in `main.ts`. `MessageStored` is only a hint to other slices; Intake's own chat state is recomputed inside the store transaction.

Composition root: `src/main.ts` and `src/main/` (split by responsibility, ADR-013) read settings and secrets, builds the adapters, wires them to the ports, holds the one ordered list of every slice's migration files (TD-3) and starts the MCP adapter. A `LeaseSupervisor` (an inbound adapter wired here) tries the lease at start and every 10 seconds; it starts the scheduler and the optional listener when this process is the owner and stops them when it is not. Nothing else instantiates an adapter.

Slice dependency graph (an arrow is a call to the other slice's published port): Inbox to Intake, Drafts and Orders; Drafts to Intake and Orders; Notify to Inbox and Intake; Orders to Knowledge and Intake; Setup to Intake, Knowledge and Notify; Knowledge to Intake. The graph is acyclic, and Drafts calls none of Inbox, Notify, Knowledge or Setup. Where a tool needs two slices the MCP adapter composes them: the catalog mark on `list_drafts` (Drafts and Knowledge), and the lesson and wipe tools (Drafts' log read, then Knowledge, which owns its input type `DraftOutcome` and imports nothing of Drafts).

Dependency rule (enforced by a test, see Testing): `domain` imports only `domain` and `shared`; `application` imports no adapter; a slice imports another slice only through its `index.ts`; nothing in `src/` imports `src/main.ts`; nothing under `src/adapters/` (shared adapter code such as `google/` and `cli/`) imports a slice, and only a slice's `adapters/` folder, `src/composition/` and `src/main.ts` import `src/adapters/`. `src/adapters/mcp/` holds only shared MCP code (`ToolDefinition`, the customer-text helper). The MCP server, its instructions and the composed tools live in `src/composition/mcp/` (L8): it may import any slice's `index.ts` (inbound ports only) so that tools that compose several slices (`status`, `get_settings`, `set_setting`, `list_drafts`, the lesson tools) have one home, and only `src/main.ts` imports `src/composition/`. No slice imports it. The stdout of the process is the MCP transport; logs go to stderr.

Slice rules that follow from the FRDs: Inbox never asks Drafts for text (FR-INBOX-02-15). Drafts never pushes to Knowledge; Knowledge reads the log (FR-KNOWLEDGE-02-1). Notify keeps no copy of the ignore list (FR-NOTIFY-02-10).

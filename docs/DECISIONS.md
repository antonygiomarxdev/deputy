# Decisions

Product decisions made by the owner, and design decisions the lead made while reviewing the slice documents. Newest decisions are added at the end with the next number. A decision stays here until the document in its "Goes into" column says it; then its row moves to `docs/decisions/YYYY-MM.md`. Technical decisions go in ADRs (`docs/adr/` for decisions that span slices, `docs/<slice>/adr/` for one slice), written with the Technical Proposal.

## Owner decisions

| ID | Date | Decision | Goes into |
|---|---|---|---|
| D9 | 2026-11-17 | **Learning: open.** Nothing is learned without the owner's ok, and each learned item links to the chat and draft it came from. How facts, tone and one-customer cases are told apart is still to design (Knowledge slice). | docs/knowledge/frd/FRD-02-learned-knowledge.md (pending) |
| D18 | 2026-11-17 | **First live agents.** Live checks (stdio idle timeout, server instructions) run first on Claude Code, then Codex. | docs/tp/TP.md (pending) |
| D30 | 2026-11-18 | **Unattributed owner reply.** An owner reply that Deputy cannot tie to a chat holds every send, and the notice says clearly why and what the owner must do. | docs/drafts/adr/ADR-006-new-since-the-draft.md (pending) |

## Lead decisions (design, from the reviews)

| ID | Date | Decision | Goes into |
|---|---|---|---|
| L8 | 2026-11-18 | Gaps the Intake specs found in the Intake TPs. `chats` and `messages` gain `provider_sender` and `provider_id`. A message that matches a Deputy send is never unattributable. Signals that another slice consumes live in `src/shared/signals.ts`. Tools that compose several slices (`status`, `get_settings`, `set_setting`, `list_drafts`, the lesson tools) live in `src/composition/mcp/`; that folder holds the MCP server and its instructions, may import any slice's inbound ports and `src/adapters/`, and only `src/main.ts` imports it. Each slice's own tools live in `src/<slice>/adapters/mcp/`; `src/adapters/mcp/` holds only shared MCP code (`ToolDefinition`, the customer-text helper). Kapso field paths not confirmed by Kapso's docs are launch gates. | docs/intake/tp/TP-02-receive-and-store.md (pending) |

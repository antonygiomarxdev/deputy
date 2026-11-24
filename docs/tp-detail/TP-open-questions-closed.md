# TP: open-questions-closed

Part of [TP.md](../tp/TP.md). Moved verbatim from there; nothing changed.


Closed by the owner (docs/DECISIONS.md):
- D15: the L6 scrub is one narrow, tested exception to the append-only drafts log. (This closes the old question about the L6 scrub.)
- D16: a second session is read-only, with no drafting.
- D17: v1 ships as a compiled binary (`bun build --compile`).
- D18: live checks (the 30-minute idle timeout, `instructions` delivery, `last_active` on an echo) run first on Claude Code, then Codex.
- D19: sensitive settings change only through the owner's terminal command; Setup shows the command, waits and confirms (TD-8).
- FR-INTAKE-03-1 stays as written. The inbox window (D3) never limits catch-up; the TP was fixed to match (TD-5).

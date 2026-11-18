# ADR-006: Owner numbers are proposed in Setup and applied by the owner's terminal command

## Status
Accepted (2026-11-18)

## Context
L4 and FR-SETUP-02-8: owner numbers change only by an explicit owner command, shown back for confirmation, with a second confirmation when the number already has stored customer messages. D19: no agent tool changes a trust boundary. From Setup TP-02, TD-3.

## Decision
The tool `setup_owner_number` takes the number as typed and the owner's words. Setup asks Intake to describe the number (E.164 form, already an owner number, count of stored customer messages), records a `owner_number_proposed` fact, and returns the parsed form and the command `deputy config set owner-numbers "<E.164>"`. With customer messages above zero it first returns `needs_second_confirmation` and shows the command only after the owner's second words. The owner runs the command; Intake's `ApplyPendingChanges` applies and logs it; Setup reads the applied list back. Setup does not parse numbers: Intake owns that behind its own port.

## Alternatives
- A generic printed command only: no show-back and no warning for a number with customer chats.
- A tool that writes the number after the owner's words: an injected agent could make a customer the owner, which D19 forbids.

## Consequences
- Easier: the owner sees the exact number before it counts; the dangerous case is warned.
- Harder: the owner must open a terminal; Setup depends on an Intake query that does not exist yet.
- Watch: the owner can type a different number than the one confirmed; the list and the final summary show it.

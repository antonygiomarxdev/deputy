# REQ-15: A local pilot that answers by itself what the owner's knowledge backs

Status: Open

## Summary

The owner asks for the smallest version that can run on their own computer: Claude Code with the owner's own subscription, no cloud and no separate service. Deputy answers by itself what the business knowledge backs and asks the owner for the rest. A pilot with the owner and one friend measures how much of the plan this uses. The daily loop is drawn in `docs/PRODUCT.md`.

Last change: 2026-11-24, first draft with its open questions

## Who asked and when
The owner, 2026-11-24, in a Claude Code session, over several messages.

## What they said
The owner asks to try a version that runs only on their computer. It answers customers on its own when it knows the answer, and asks the owner over WhatsApp when it does not. Installing should be a request to Claude with a link, and setup should be a conversation in which the owner explains the business.

## The problem behind it
The approved product needs the owner's go on every send (D1) and a terminal for setup (D19), so a non-technical owner cannot start and a busy owner still approves each draft by hand. The pilot gives up part of principle 1 for a standing, capped rule and moves setup into the conversation.

## Evidence
- Built today: catch-up polling every 2 minutes (FR-INTAKE-03-10), 12 tools, owner numbers, the drafts log, the 24 hour window rule for retries (Drafts ADR-012).
- Documents only: knowledge files, the skill (REQ-12), setup by conversation, asking the owner by WhatsApp (REQ-1). Not built: waking an idle session (`claudeChannel` is false in `src/main/tools.ts`), keep-awake, pre-allowed tools.
- Unknown: plan usage of an idle loop; whether Claude Code shows a form answer to the model; Windows, macOS and Linux behavior of keep-awake.

## Decision
Open until the owner accepts. Decided by the owner on 2026-11-24, recorded as Draft D31 to D35 in `docs/DECISIONS.md`:
- Local only, Claude Code, the owner's own subscription, Windows, macOS and Linux. The pilot is the owner and one friend. Cloud, a separate server, a hosted database and OAuth are deferred.
- Semi-automatic: Deputy answers by itself what the knowledge backs, inside the 24 hour window, with a daily cap and a kill switch, logged as auto. For the rest it asks the owner from the business number to the owner's number, and the reply comes back to the session. With the window closed it asks in the Claude app and tells the owner to answer on WhatsApp.
- Setup by a Deputy skill: knowledge is files on the owner's computer plus documents the owner shares through their connectors. The skill sets the Kapso connection and the owner numbers, with no command-line commands. The Kapso key goes into a Deputy form straight to the OS secret store, never through the chat (D19 holds).
- Wake: channels, with an installer shortcut that launches Claude Code with the development-channels flag, plus a slow loop every 30 to 60 minutes as backup. Deputy keeps the computer awake while the session is open.
- No permission prompt may block: the skill pre-allows only Deputy tools and the session runs no shell commands.

Open questions:
- Q-1 (Owner): the owner's control chat. An owner message to the business number is classified `owner_app`, and D30 holds every send for an owner reply Deputy cannot tie to a chat. The control chat needs its own handling (Intake FRD-04).
- Q-2 (Owner): Anthropic Consumer Terms 3.7 for a session that answers while the owner is away; ask Anthropic in writing (#144).
- Q-3 (Owner): which classes always ask the owner (orders, prices outside the catalog, addresses, complaints), and whether a plain yes over WhatsApp is the go for one draft.

# REQ-15: A local pilot that answers by itself what the owner's knowledge backs

Status: Open

## Summary

The owner asks for the smallest version that can run on their own computer: Claude Code with the owner's own subscription, no cloud and no separate service. Deputy answers by itself what the business knowledge backs and asks the owner for the rest. A pilot with the owner and one friend measures how much of the plan this uses. The daily loop is drawn in `docs/PRODUCT.md`.

Last change: 2026-11-24, form and customer window checks marked as proposed

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
Open until the owner accepts. Decided by the owner on 2026-11-24, recorded as Draft D31 to D36 in `docs/DECISIONS.md`:
- Local only: Claude Code with the owner's own subscription, on Windows, macOS and Linux. The pilot is the owner and one friend. Cloud, a separate server, a hosted database and OAuth are deferred. There is no tunnel: the owner chose polling over a tunnel.
- Install: the owner asks Claude Code to install Deputy from a link. Receiving: the MCP polls Kapso every 1 to 2 minutes and catches up on start. The current code is reused and trimmed.
- The owner opens the session by hand. Nothing starts Claude automatically (no `claude -p`, no cron job, no server). The guide tells the owner to message the business number at least once a day. Keep-awake asks for the lid open and the computer plugged in, and Deputy keeps the computer awake while the session is open.
- Wake: channels, started from a shortcut the owner clicks to open Claude Code with the channels flag, plus a slow loop every 30 to 60 minutes as backup.
- Semi-automatic: Deputy answers by itself what the owner's knowledge backs. For the rest it asks the owner from the business number to the owner's number, and the reply comes back to the session. When the owner's 24 hour window with the business number is closed, the session asks in the Claude app and tells the owner to answer on WhatsApp. The customer's 24 hour window is the existing Drafts rule (ADR-012, D29): it closes 24 hours after the customer's latest message, and a retry outside it fails at once and the owner is told. That is not a new decision.
- Setup by a Deputy skill: the owner explains the business, and knowledge is files on the owner's computer plus what the owner gives (a Sheet, documents). The skill sets the Kapso connection and the owner numbers, with no command-line commands. D19 is amended for the pilot: the owner chose a Deputy form that writes the Kapso key straight to the OS secret store, never through the chat.
- No permission prompt may block: the skill pre-allows only Deputy tools and the session runs no shell commands.

Proposed, pending the owner: a daily cap, a kill switch, answers logged as auto, a check of the customer window before a first send, and the Kapso form as a one-time loopback page (whether the model sees elicitation input is unverified).

Open questions:
- Q-1 (Owner): the owner's control chat. An owner message to the business number is classified `owner_app`, and D30 holds every send for an owner reply Deputy cannot tie to a chat. The control chat needs its own handling (Intake FRD-04).
- Q-2 (Owner): Anthropic Consumer Terms 3.7 for a session that answers while the owner is away; ask Anthropic in writing (#144).
- Q-3 (Owner): which classes always ask the owner (orders, prices outside the catalog, addresses, complaints), and whether a plain yes over WhatsApp is the go for one draft.

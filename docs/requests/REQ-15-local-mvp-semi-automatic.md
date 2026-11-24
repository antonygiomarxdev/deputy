# REQ-15: A local pilot that answers by itself what the owner's knowledge backs

Status: Open

## Summary

The owner asks for the smallest version that can run on their own computer: Claude Code with the owner's own subscription, no cloud and no separate service. Deputy answers by itself what the business knowledge backs and asks the owner for the rest. A pilot with the owner and one friend measures how much of the plan this uses. The daily loop is drawn in `docs/PRODUCT.md`.

Last change: 2026-11-24, owner rulings recorded; cap and kill switch dropped; control chat and always-ask classes decided

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
Open until the owner accepts the request; one question stays open (Q-1). Decided by the owner on 2026-11-24, recorded in `docs/DECISIONS.md` (D31 is archived in `docs/decisions/2026-11.md` and approved in `docs/PRODUCT.md`; D32 and D34 to D36 are still Draft):
- Local only: Claude Code with the owner's own subscription, on Windows, macOS and Linux. The pilot is the owner and one friend. Cloud, a separate server, a hosted database and OAuth are deferred. There is no tunnel: the owner chose polling over a tunnel.
- Install: the owner asks Claude Code to install Deputy from a link. Receiving: the MCP polls Kapso every 1 to 2 minutes and catches up on start. The current code is reused and trimmed.
- The owner opens the session by hand. Nothing starts Claude automatically (no `claude -p`, no cron job, no server). The guide tells the owner to message the business number at least once a day. Keep-awake asks for the lid open and the computer plugged in, and Deputy keeps the computer awake while the session is open.
- Wake: channels, started from a shortcut the owner clicks to open Claude Code with the channels flag, plus a slow loop every 30 to 60 minutes as backup.
- Semi-automatic (D31, approved in PRODUCT): Deputy answers by itself what the owner's knowledge backs, while customers ask and while the owner's Claude plan limit is not reached. Every auto answer is logged as automatic. Before a send it checks the customer's 24 hour window and, if closed, tells the owner instead of failing (ADR-012, D29). For the rest it asks the owner from the business number to the owner's number, and the owner's WhatsApp answer is the go for that answer. When the owner's 24 hour window with the business number is closed, the session asks in the Claude app and tells the owner to answer on WhatsApp.
- Control chat (D37): the chat from the owner's personal number to the business number carries answers and instructions for the session. Its messages are never customer messages and never hold sends. Owner replies to customers from the Business app keep holding as today (D30).
- Always-ask classes (D38): set per business during setup. The setup skill interviews the owner, learns the business and agrees what must always be asked, for example a delivery price that depends on the address.
- Setup by a Deputy skill: the owner explains the business, and knowledge is files on the owner's computer plus what the owner gives (a Sheet, documents). The skill sets the Kapso connection and the owner numbers, with no command-line commands. D19 is amended for the pilot (D33): a Deputy form writes the Kapso key straight to the OS secret store, never through the chat, as a one-time loopback page.
- No permission prompt may block: the skill pre-allows only Deputy tools and the session runs no shell commands.

Later, in the backlog: hours and schedules, a daily cap and a kill switch. The pilot has none of them.

Open questions:
- Q-1 (Owner): Anthropic Consumer Terms 3.7 for a session that answers while the owner is away (#144). The owner chose not to ask Anthropic now.

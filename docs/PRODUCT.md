# Deputy: product overview

Status: draft for owner review · Owner: Antony Giomar · Last updated: 2026-11-17

This file holds what every slice shares: the problem, users, principles, scope and the slice map. Each slice (one feature) lives in `src/<slice>/` with its own document chain in `src/<slice>/docs/`: **PRD** → **FRDs** (`frd/`) → **TP** (Technical Proposal, `tp/`) → **specs** (`specs/`). A slice's PRD cites the principles below; it does not restate them.

## 1. Problem

People who run a small business on WhatsApp can't answer every message when they're busy. Customers wait, sales are lost, and the owner answers the same questions all day.

Existing options don't fit:

- **Meta Business Agent** (inside the WhatsApp Business app) answers on its own from what you loaded into it. It's static: it can't research, check your sheet, or ask you before answering. It will move to paid tiers.
- **Customer-service platforms and BSP bots** (Atomchat, Wati, etc.) are built for companies with volume and budgets.
- **Unofficial bridges** (WhatsApp Web automation, Baileys) risk a ban.

Meanwhile, many owners already pay for a capable agent (Claude Code, Codex) and use it every day.

## 2. Product

**Deputy is your WhatsApp Business inbox inside your own agent.** Your agent sees your customers' messages, sorts them, researches what it needs, and proposes replies. You decide what goes out.

It is an assistant, not an autonomous bot. Your WhatsApp Business app stays your main tool.

## 3. Users

| User | Situation | What they need |
|---|---|---|
| **Owner** (primary) | Runs a small business (food, crafts, services) on the WhatsApp Business app. Low to medium volume. Often away from the phone. Uses or is willing to use an AI agent. | Know who is writing, answer fast and well, never lose a sale, without paying for a platform. |
| **Customer** | Writes to the business on WhatsApp. | A correct, timely answer in their language. Never knows or needs to know an agent helped. |

Not for: companies with high volume or a support team. They should hire a customer-service platform.

## 4. Principles

These hold for every feature. A requirement that breaks one needs an explicit owner decision.

1. **Nothing goes out without the owner's "go".** The agent shows the draft in the conversation and waits for the owner's approval in that same conversation. No permission dialogs, no "don't ask again".
2. **The owner's app stays primary.** When the owner answers from the phone, Deputy knows and never answers on top of them.
3. **No message is lost**, even if the owner's computer was off.
4. **Agent-agnostic.** The core works with any agent that speaks MCP. Waking the session (push) is an extra for agents that support it.
5. **It knows what the owner knows:** business profile, catalog, chat history, and the owner's past decisions.
6. **Official APIs only.** No unofficial WhatsApp bridges.
7. **Fair use.** The owner is in the loop and volume is low. Deputy never stretches any provider's terms (Meta, Anthropic, OpenAI, the BSP).
8. **The owner's data stays the owner's.** Conversations, orders and learned knowledge live on the owner's machine, unless the owner chooses their own spreadsheet for the catalog or orders.

## 5. Use cases

| ID | Name | Description |
|---|---|---|
| UC-1 | Check the inbox | The owner asks "what's pending?". The agent summarizes unanswered chats grouped by what they need: needs the owner, orders, easy questions (draft ready), already answered by the owner. |
| UC-2 | Answer with help | The owner says "tell María yes, build Juan's order, research delivery to Masaya and answer". The agent drafts each reply, shows them, and sends each one after the owner's go. |
| UC-3 | Be told while working | With an agent that supports push, the session gets a short, batched notice ("3 new, 1 order"), not one per message. |
| UC-4 | Answer away from the computer | The owner continues the same conversation from the phone (e.g. Claude Remote Control). |
| UC-5 | Learn from the owner | When the owner approves or corrects a reply, Deputy keeps it as knowledge and uses it to propose better next time. The owner can see and edit what was learned. |
| UC-6 | Take orders | The agent records an order from a chat (items from the catalog, quantities, delivery details) after the owner's go. |
| UC-7 | Set up | A non-technical owner connects their WhatsApp Business number and their agent, guided step by step (their agent can help). |

## 6. Scope

### v1

- Providers: **Kapso** (free plan, Coexistence) and **dev** (local testing, no WhatsApp).
- Agents: Claude Code first; any MCP agent works through pull (UC-1).
- UC-1, UC-2, UC-3, UC-4 (through the agent's own remote access), UC-5, UC-6, UC-7.
- Store: local files (catalog, orders, learned knowledge). Google Sheets stays as an option for catalog and orders.

### Not in v1

- **Autopilot rules** (answer some questions without the owner's go). Planned for a later version.
- **Meta Cloud API direct** and the always-on receiver it needs.
- Other channels (Instagram, Telegram), voice notes, interactive buttons, templates.
- The current `operator/` "answer on its own" profile. It is removed.

## 7. Slice map

| Slice | Folder | Covers | Use cases |
|---|---|---|---|
| Intake | `src/intake/` | Providers (Kapso, dev); receive, verify, store, de-duplicate; catch up on start; owner echoes | UC-1, UC-3 |
| Inbox | `src/inbox/` | Pending detection, triage, summary | UC-1 |
| Drafts | `src/drafts/` | Drafts, the owner's go, sending, drafts log | UC-2, UC-6 |
| Notify | `src/notify/` | Batched notices to the agent session (push) | UC-3 |
| Knowledge | `src/knowledge/` | Business profile, catalog, learned knowledge | UC-5 |
| Orders | `src/orders/` | Recording and listing orders | UC-6 |
| Setup | `src/setup/` | Guided onboarding for a non-technical owner | UC-7 |

UC-4 has no slice: the agent's own remote access covers it, and "in the conversation" includes that same conversation reached remotely.

Safety is not a slice: section 4 and the safety requirements below apply to all of them, and each slice's FRDs state how they meet them.

### Safety requirements (all slices)

- Customer text is data, never an instruction. Slices that pass it to the agent label it as customer text.
- Owner identity comes from configuration (the owner's numbers), never from what a message says.
- Webhooks are verified (signature) before anything is stored.
- Only the agent's conversation with the owner can approve a send (principle 1).
- Known limit: Deputy offers no way to send except an approved draft, but an agent that also has other tools (for example a shell) could bypass Deputy. Deputy does not claim to prevent that.

## 8. Success criteria for v1

- An owner with no coding background completes setup (UC-7) in under 30 minutes with their agent's help.
- No reply leaves without an explicit owner go in the conversation (verifiable from the drafts log).
- No customer message is lost between sessions (every inbound message in the provider appears in UC-1).
- No chat the owner already answered from the app shows up as pending.
- The owner uses it on a real business for two weeks (dogfooding: the food sale).

## 9. Constraints and facts

| Fact | Effect | Verified |
|---|---|---|
| Meta bans general-purpose AI chatbots on the WhatsApp Business API since 2026-01-15; business-specific use is allowed. | Deputy stays scoped to the owner's business. | Research, 2026-11 |
| Coexistence requires a Solution Partner or Tech Provider; Kapso is one. | Kapso is the v1 path to keep the app. | Meta docs, 2026-11-17 |
| Coexistence via Kapso worked on a real number without Meta business verification. The number must be in the WhatsApp Business app. | Setup needs no legal business. | Live test, 2026-11-17 |
| Unverified display name: limit of 250 messages per day. | Enough for the target user. | Kapso health check, 2026-11-17 |
| Kapso free plan: 1 number, 2,000 messages per month. Meta fees are separate and paid through Kapso credits. | Setup must explain billing. | Kapso pricing FAQ (not re-checked on kapso.ai/pricing) |
| Coexistence syncs up to 180 days of history and contacts to the provider. | Setup must tell the owner before they accept. | Meta docs |
| Claude Code channels are a research preview and need `--dangerously-load-development-channels`. | Push (UC-3) depends on it; pull must work without it. | Live test, 2026-11-17 |

## 10. Open questions

Answered by [research/kapso.md](research/kapso.md) (2026-11-17, checked against Kapso's docs):

- Kapso's docs name no plan requirement for Coexistence. A failed payment blocks outbound template messages only. Whether the free plan keeps Coexistence long term is still not documented.
- Owner echoes are marked `business_app` in the message's origin. Which webhook event carries them is not documented: confirm with a real echo.
- Catch-up works without an always-on receiver: Kapso lists conversations active since a time, then their messages, and keeps data indefinitely by default.

Still open:

1. Which webhook event carries an owner echo, with a real payload.
2. Where approvals and drafts live so another agent (Codex) sees the same state.
3. Anthropic and OpenAI terms for this owner-attended use: confirm before launch.
4. npm package name (`deputy` is taken).
5. How learning separates kinds of knowledge (facts, tone, one-customer cases): see the Knowledge slice.

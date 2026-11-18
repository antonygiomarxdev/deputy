# Glossary

Terms every slice uses. Use them with these meanings, and add a term here before a second slice needs it.

| Term | Meaning |
|---|---|
| **Owner** | The person who runs the business and uses Deputy through their own agent. |
| **Customer** | Anyone who writes to the business number who is not the owner. |
| **Agent** | The owner's AI agent session (Claude Code first) that Deputy connects to. |
| **Provider** | The service that gives Deputy official access to the WhatsApp number: Kapso in v1, or dev for testing. |
| **Coexistence** | Using the same number in the WhatsApp Business app and through the provider at once. |
| **Chat** | All messages with one customer. |
| **Pending** | A chat whose latest customer message, inside the inbox window, has been answered neither by Deputy nor by the owner, and that the owner has not ignored. |
| **Draft** | A reply or an order the agent prepared for one chat, waiting for the owner's go. Each has a number. |
| **Go** | The owner's reply in the conversation that clearly identifies which drafts it approves (D1). |
| **Source** | Who a stored message came from: customer, owner from the app, or sent through Deputy. Intake decides it; other slices never guess it from the text. |
| **Echo** | A message the owner sent from the WhatsApp Business app, reported back by the provider. Stored with source "owner from the app". |
| **Catch-up** | Asking the provider for messages Deputy has not stored yet: when the session opens, and then periodically while it is open (D12). |
| **Live delivery** | The provider pushing each message to Deputy as it happens. Optional (D12). |
| **Notice** | A short message to the agent session with counts of new and waiting chats (D5). |
| **Learned item** | Something the owner approved for Deputy to remember for later drafts (D9). |
| **Drafts log** | The record of every draft: proposed, approved (with the owner's words), changed, rejected, sent or failed. |
| **Dev mode** | Running Deputy with the dev provider: no WhatsApp, test messages only. |

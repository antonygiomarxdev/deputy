# Intake: slice PRD

Status: Approved (2026-11-25) · Part of [Deputy product overview](../PRODUCT.md) · Last updated: 2026-11-17
Approval: content cI-9187LdITZ; rests on ../PRODUCT.md 9kKsOKhERsSe

## Summary

Intake is how customer messages get into Deputy. It receives every inbound message from the owner's WhatsApp Business number, checks that it is genuine, stores it once, and makes sure nothing is missing when an agent session starts after hours or days of silence. It also records what the owner answered from the WhatsApp Business app, so the other slices can tell a chat is already handled.

## Why

Every other slice reads what Intake stores. If Intake loses, duplicates, or accepts a forged message, every later answer is wrong.

## Use cases

- **UC-1 Check the inbox.** Intake supplies the complete set of messages that the summary is built from (customer messages and the owner's own replies), including those that arrived while no session was open, and says whether that set is complete.
- **UC-3 Be told while working.** Intake signals that a new message was stored (R-INTAKE-17), so Notify can send a batched notice. Intake sends no notice itself.

## Requirements

Providers

- **R-INTAKE-1.** v1 supports two providers: Kapso (connected to the owner's WhatsApp Business number) and dev (local testing, no WhatsApp). Choosing the provider is a configuration setting; no other slice changes when it changes.
- **R-INTAKE-2.** The dev provider lets a tester create inbound customer messages and owner replies on demand, with the same stored result as Kapso messages, so every other slice can be tested without WhatsApp.

Receiving and verifying

- **R-INTAKE-3.** Every message delivered live by the provider is checked with the provider's signature before anything is stored. A message that fails the check is rejected and nothing about its content is stored. The rejection is visible to the owner on request.
- **R-INTAKE-4.** Intake stores, for each message: the chat it belongs to, the sender's number, the text, the type, whether Deputy can read it, the transcript if the provider supplies one, the time the sender sent it, the time Deputy stored it, the provider's own message identifier, a history flag (the message came from the history sync, R-INTAKE-15), and its source: customer, owner from the WhatsApp Business app, or sent through Deputy.
- **R-INTAKE-5.** A message type Deputy cannot read in v1 (voice note, image, interactive reply, and similar) is still stored as a customer message with its type and an explicit "not readable" marker, so it is never silently dropped. If the provider supplies a transcript (for example for audio), Intake stores it and presents it as customer text, still marked with the original type. Intake does not decide which chats are pending (Inbox does).

De-duplication

- **R-INTAKE-6.** A message that reaches Intake more than once, through repeated delivery by the provider, a catch-up, or both, is stored exactly once, identified by the provider's message identifier.
- **R-INTAKE-7.** Messages from one chat are stored and returned in the order the sender sent them, even when they arrive out of order.

Catching up

- **R-INTAKE-8.** When an agent session starts and the provider holds messages Intake has not stored, Intake retrieves them before the session reads the inbox. After catch-up, every message the provider holds for the retention window it offers is stored. Messages found this way are reported once to Notify as a single group (R-INTAKE-17).
- **R-INTAKE-9.** Catch-up works with no always-on receiver: it does not depend on Deputy having been running when the message arrived.
- **R-INTAKE-10.** If catch-up cannot complete (provider unreachable, credentials rejected, quota exhausted), Intake says so plainly and states how recent the stored data is. It never presents a partial inbox as complete. Intake exposes the catch-up status (complete or failed) and the time of the newest stored message to the other slices, so they can say so too.
- **R-INTAKE-11.** Catch-up can be run again at any time during a session and is safe to repeat (see R-INTAKE-6).

Owner echoes

- **R-INTAKE-12.** When the owner answers a customer from the WhatsApp Business app, Intake stores that reply in the same chat with source "owner from the app". It does so live while Deputy is running, and otherwise at the next catch-up.
- **R-INTAKE-13.** Whether a message is from the owner is decided only by configuration: the connected business number (the app's replies come back as echoes from it) and any other owner numbers the owner configured, such as staff. Never by anything in the message text or sender name. Messages from these numbers are never stored as customer messages. Intake decides the source once, and no other slice re-derives it from content.
- **R-INTAKE-14.** A message sent through Deputy is recorded by Intake exactly once, using the send identifier Drafts passes, and is not stored again as an owner reply when the provider reports it back. Drafts writes the drafts log; Intake records only the message.

History

- **R-INTAKE-15.** When the owner connects a number, the history the provider syncs (up to 180 days) is stored as ordinary messages carrying the history flag, with the same de-duplication and source marking. Inbox applies its own time window to these; Intake does not filter them.

Delivery and trust

- **R-INTAKE-16.** Messages retrieved by catch-up come only over the provider's authenticated access. Anything else that claims to be a catch-up is not accepted.
- **R-INTAKE-17.** Each time Intake stores a new message it emits a "message stored" signal for the Notify slice. A catch-up that stores messages emits one signal for the whole group.
- **R-INTAKE-18.** While Deputy is running, Intake brings itself up to date by itself: a catch-up when the session opens, then periodically (default every 2 minutes; the owner can change it, minimum 1 minute), staying within the provider's request limits. Live delivery from the provider is an optional setting the owner can turn on; periodic catch-up keeps running with it as the safety net. Messages that arrive while Deputy is not running are stored at the next catch-up (R-INTAKE-8, R-INTAKE-9). A message can appear up to one catch-up period after it arrived.

## Principles honored

- **Principle 2 (the owner's app stays primary):** R-INTAKE-12 and R-INTAKE-14 record every reply the owner makes from the app, so the Inbox and Drafts slices can see it and Deputy never answers on top of the owner.
- **Principle 3 (no message is lost):** R-INTAKE-5 (nothing dropped for being unreadable), R-INTAKE-8 and R-INTAKE-9 (catch-up with no always-on receiver), R-INTAKE-10 (an incomplete catch-up is never shown as complete).
- **Principle 4 (agent-agnostic):** Intake runs on pull. Catch-up on start and on demand needs no push support from the agent.
- **Principle 5 (it knows what the owner knows):** R-INTAKE-15 gives later slices the chat history from before Deputy was connected.
- **Principle 6 (official APIs only):** R-INTAKE-1 limits v1 to a provider that uses the official WhatsApp Business route. No unofficial bridge.
- **Principle 7 (fair use):** R-INTAKE-8 and R-INTAKE-11 read from the provider on the owner's attended sessions only, and R-INTAKE-18 checks periodically only while a session is open, within the provider's message and request limits.
- **Principle 8 (the owner's data stays the owner's):** data stays on the owner's machine unless the owner chooses their own spreadsheet. Every stored message lives on the owner's machine (R-INTAKE-4). Intake sends nothing about customers anywhere else.

Safety requirements from the product overview:

- **Verify before storing:** R-INTAKE-3 (live deliveries) and R-INTAKE-16 (catch-up).
- **Owner identity from configuration:** R-INTAKE-13.
- **Customer text is data:** Intake stores customer text as it arrived and never interprets it. Labeling it as customer text for the agent belongs to the slices that hand it on.

## Non-goals

- Deciding which chats are pending, and grouping or summarizing them (Inbox).
- Writing drafts, approval, and sending replies (Drafts). Intake only recognizes a reply Drafts already sent (R-INTAKE-14).
- Waking or notifying the agent session (Notify).
- Business profile, catalog, and learned knowledge (Knowledge). Orders (Orders). Guided onboarding and provider account creation (Setup).
- Meta Cloud API direct and any always-on receiver.
- Other channels: Instagram, Telegram. Understanding voice notes, images, or interactive replies.
- Sending messages.

## Dependencies

- **Setup** supplies the provider connection details and the owner's numbers; Intake uses them. Until Setup has run, Intake can only run on the dev provider.
- **Inbox** reads the stored messages (with source and history flag) and the catch-up status, and applies the time window.
- **Drafts** relies on Intake to recognize the owner replies that Drafts itself sent, and to see owner replies made from the app before it sends.
- **Notify** uses the "message stored" signal (R-INTAKE-17).
- **Knowledge** may read stored history. How learning works is still open (see the product overview).
- Product-level facts that apply: the 180-day history sync, the free plan's 2,000 messages per month, and the 250 messages per day limit (see [PRODUCT.md section 9](../PRODUCT.md)).

## Success criteria

1. With the dev provider, a customer message created by the tester is stored once with all fields of R-INTAKE-4, and appears to the Inbox slice.
2. A message that fails the authenticity check is rejected and absent from storage (R-INTAKE-3).
3. Delivering the same message three times, in any mix of live delivery and catch-up, leaves exactly one stored message (R-INTAKE-6).
4. Messages delivered in reversed order are returned in sending order (R-INTAKE-7).
5. A voice note or image from a customer is stored, marked not readable, and shown to the Inbox slice as a customer message. When the provider supplies a transcript, it is stored and shown as customer text (R-INTAKE-5).
6. With Deputy not running while three customer messages and one owner reply arrive at the provider, the first session after that stores all four, and the owner reply is marked as from the owner (R-INTAKE-8, R-INTAKE-9, R-INTAKE-12).
7. With the provider unreachable at session start, the user is told that catch-up failed and the time of the newest stored message. The inbox is not presented as complete (R-INTAKE-10).
8. A reply sent through Deputy is stored once, not once as a Deputy send and once as an owner reply (R-INTAKE-14).
9. A message whose text claims "I am the owner" is stored as a customer message; a message from the connected business number or a configured owner number is stored with an owner source (R-INTAKE-13).
10. After the owner connects an existing number, history from before connection is stored without duplicates (R-INTAKE-15).
11. A live delivery with a bad signature is rejected; a catch-up not made over the provider's authenticated access is not accepted (R-INTAKE-3, R-INTAKE-16).
12. Storing a new message emits one "message stored" signal; a catch-up that stores three messages emits one signal for the group (R-INTAKE-17).
13. After a failed catch-up, the other slices can read status "failed" and the newest stored message time (R-INTAKE-10).
14. v1 success criterion: every inbound message the provider holds appears in the UC-1 summary (see [PRODUCT.md section 8](../PRODUCT.md)).

## Open questions

These come from [PRODUCT.md section 10](../PRODUCT.md) and are answered by the Kapso research task, not guessed here.

1. How does Kapso report an owner reply made in the WhatsApp Business app: as a live event, through its message listing, or both, and with which fields? The message listing marks them (origin "business_app", checked live 2026-11-17), so catch-up gets them; which live event carries them is still unchecked.
2. Can Kapso list messages received while no session was open, and from how far back? This decides whether R-INTAKE-8 holds for the full retention window or a shorter one.
3. Does the free plan keep Coexistence long term? If not, the provider requirement R-INTAKE-1 needs revisiting.
4. How does Kapso identify a message sent through its API when it is reported back (R-INTAKE-14)?
5. What does Kapso provide for the history sync (R-INTAKE-15): a bulk listing, live events, or both?
6. Does catch-up count against the free plan's monthly message limit? (Settled: Kapso keeps data indefinitely by default, and the history sync goes back up to 180 days.)
7. For R-INTAKE-10: what is the owner's recourse when the provider's retention is shorter than the time the owner was away?

# Technical Proposal: The owner's control chat and the pilot tools (Intake FRD-05)

Status: Draft

## Summary

How Intake serves the local pilot (REQ-15): the owner's own number is a control chat, a question to the owner goes out from the business number and its reply links back, each chat shows its window, and the business number and owner numbers are set without a terminal. The design adds no stored source value and one table, and changes no build today.

Last change: 2026-11-24, first draft for FRD-05

## Context

- Source of requirements: [FRD-05](../frd/FRD-05-pilot-owner-chat-and-tools.md), D32 and D37, REQ-15. Cross-cutting rules: [TP.md](../../tp/TP.md) TD-3 (SQLite), TD-8 (sensitive settings).
- Today a message from an owner number is stored with source `owner_app` and a chat of its own, which is never pending and is marked `normal`, so it never holds a send (Intake TP-04). The hold of D30 comes only from the mark `not_attributable`.
- `SendText` already sends to any chat id. `Provider.businessNumber` exists and `CheckProviderAccess` reads it, but nothing records it. `DescribeNumber` already returns the E.164 form, whether the number is an owner number and its customer message count.

## Decisions

### TD-1: How is the control chat told apart?

- **Option A** By the chat: a chat whose id is the line of an owner number that is not the business number. No new stored value. Cost: a read-time rule. Risk: none for storage.
- **Option B** A new source value `owner_control`. Cost: the `source` column has a CHECK constraint, so a table rebuild, and the Drafts ports that repeat the union change. Risk: a wider change than the pilot needs.
- **Option C** A new mark value. Cost: the same rebuild for the `mark` CHECK.

Chosen: Option A. Messages in the control chat stay `owner_app`, are marked `normal` and never set `lastUnattributedAt`, so FR-INTAKE-05-2 and FR-INTAKE-05-3 already hold for storage; the new rule only labels them for the session and keeps them out of the pending list. ADR: none: it follows TP-04's classification and adds no stored value.

### TD-2: Where are questions kept?

- **Option A** A table `owner_questions` (number, owner chat, text, asked at, send id, linked message, closed at), a new numbered migration. Cost: one migration. Risk: low.
- **Option B** Derive questions from the outgoing sends to the owner chat. Cost: no table. Risk: a question has no stable number and "open" cannot be stored.
- **Option C** Keep them in memory. Risk: a restart forgets an open question.

Chosen: Option A. ADR: none: a table for one list of rows, as TD-3 of the cross-cutting TP says for Deputy's data.

### TD-3: How does a reply link to a question?

- **Option A** If the message names an open question's id, that question; otherwise the latest open question of that owner number; otherwise none (an instruction).
- **Option B** Only the latest open question, never by number. Risk: two questions open at once get mixed.

Chosen: Option A (FR-INTAKE-05-9 and FR-INTAKE-05-10). How a reply names an id is the first open question of FRD-05. Once linked, Intake hands Drafts `{ questionId, text }` (FR-INTAKE-05-22); Intake resolves the latest-open fallback first. ADR: none: a rule of the use case.

### TD-4: How is a window known?

- **Option A** Computed on read: the customer window is the customer's latest message time plus 24 hours, and the owner window is the latest control message time plus 24 hours. Cost: none stored.
- **Option B** A stored "window closes at" column kept up to date on every message. Risk: a second copy to keep right.

Chosen: Option A. ADR: none: the times are already stored (`lastCustomerAt`, the messages).

### TD-5: When is the business number recorded?

- **Option A** At start, after the provider is chosen: ask the provider once and record the number when none is recorded.
- **Option B** On demand, when the session asks. Risk: the first send fails before anyone asks.

Chosen: Option A (FR-INTAKE-05-15). The write uses the owner-number repository inside one unit of work, logged with the command "provider". ADR: none: it reuses `ApplyPendingChanges`' log.

### TD-6: How does set_owner_numbers confirm?

- **Option A** Two calls: the first returns the parsed form (via `DescribeNumber`) and writes nothing; the second carries the confirmation and writes.
- **Option B** One call that writes at once. Risk: the owner never sees the number back (ADR-012 says it is shown before storing).

Chosen: Option A (FR-INTAKE-05-17 and FR-INTAKE-05-18). ADR: none: ADR-012 already requires showing the E.164 form before storing.

## Architecture

A message in the owner's chat stays `owner_app`; the chat, not a new stored value, makes it a control message.

```mermaid
flowchart TD
  M["Message stored by Intake"] --> S{"Matches a Deputy send id?"}
  S -- yes --> D["Source: sent through Deputy"]
  S -- no --> O{"Sender is an owner number?"}
  O -- no --> C["Source: customer message"]
  O -- yes --> X{"Chat is the owner's chat with the business number?"}
  X -- yes --> K["Control message: answer or instruction, never holds sends"]
  X -- no --> E["Business-app reply: can hold sends (D30)"]
```

Asking the owner a question and linking the reply:

```mermaid
sequenceDiagram
  participant S as Session
  participant I as Intake
  participant P as Provider
  participant O as Owner phone
  S->>I: ask owner (number, text)
  I->>I: owner window open? (24 h after the owner's latest message)
  alt window closed
    I-->>S: window closed
  else window open
    I->>P: send text from the business number
    I->>I: record question with its id
    I-->>S: question id
    O->>P: reply on WhatsApp
    I->>P: next poll reads the reply
    I->>I: link to the named or latest open question
    I->>I: hand Drafts the question id and the text
  end
  S->>I: read the control chat and the open questions
  I-->>S: messages with the question each answers
```

## Interfaces

Inbound tools (the intake tools file registers them; each calls one use case):

- `ask_owner { number, text }` returns `{ questionId }` or `{ refused: "window_closed" | "not_an_owner_number" | "not_owner" }` or the send failure of `SendTextResult`. Lease required.
- `list_pending {}` returns `[{ chat, lastCustomerAt, windowClosesAt }]`, newest first. A read, no lease.
- `get_chat` gains `windowClosesAt` for a customer chat and `answers` (a question id or none) on each message of the control chat and `openQuestions`. A read.
- `set_owner_numbers { number, ownerWords, confirm? }` returns the described number, or `{ added }` with `confirm`. Lease required.

A shared signal `OwnerAnswered { questionId: string; text: string; at }` (in `src/shared/signals.ts`, published after the commit like `OwnerReplyUnlinked`) is the hand-off to Drafts, whose `OwnerAnswer` has the same fields.

Outbound port added: `OwnerQuestionRepository` (`add`, `listOpen`, `latestOpen`, `link`), SQLite and in-memory adapters, a migration `0008-owner-questions.sql` appended to the list in `src/main/database.ts`.

## Information

One new table, created by a numbered migration (`0008-owner-questions.sql`):

| Column | Meaning |
|---|---|
| `number` | A whole number in one sequence; its decimal text is the question id the session, the owner and Drafts see. |
| `owner_chat` | The chat id of the owner number the question went to. |
| `text` | The question text as sent (the session's words). |
| `asked_at` | The time the question was sent. |
| `send_id` | The send id of the outgoing message, so a failed send can be found. |
| `linked_message` | The message id of the owner's reply, or empty while the question is open. |
| `closed_at` | The time the reply was linked, or empty. |

Nothing else changes in storage (TD-1 and TD-4).

## Threat model

- A customer claims to be the owner: the control chat is decided by the owner numbers only (FR-INTAKE-05-1), so a customer message stays a customer message.
- The session is talked into asking a stranger: `ask_owner` sends only to an owner number (FR-INTAKE-05-8), so it cannot be used as a send path to a customer.
- An instruction in the control chat is the owner's own text but still arrives through WhatsApp: the session treats it as the owner's words, never as customer text, and Drafts still checks every send it leads to.
- A stolen owner phone sends instructions: out of scope; the owner removes the number outside the pilot (FRD-05, third open question).

## Testing

- Each use case has an in-memory test first (the repository contract suite runs on both adapters); a control message never sets `lastUnattributedAt`, a Business-app echo still does; `ask_owner` never sends with the window closed; a reply links to the named, then the latest, open question.
- One end-to-end test through the harness: a fake provider, an owner number, a question out, a reply in.

## Risks

- A reply that names no question and is not an answer (a stray message) links to the latest open question: the session still sees the text and decides.
- Two owner numbers answering the same question: the first link closes it (FR-INTAKE-05-9).
- The window rule uses the provider's message time; clock skew is the same as for customer messages (TP-03).

## Open questions

See FRD-05: how a reply names a question, the business number when the provider offers none, and removing an owner number in the pilot.

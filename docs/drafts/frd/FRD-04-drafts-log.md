# FRD-04: The drafts log

Status: Approved (2026-11-25)
Approval: content YihN-Lsoe5U4; rests on ../PRD.md 5O_P25il8pzW

Amended by REQ-15 (FR-DRAFTS-04-12 and FR-DRAFTS-04-13), approved by the owner on 2026-11-24.

## Summary

Deputy keeps an ordered log of everything that happens to a draft. The owner can read it, check that every sent message has an approval, and Knowledge can learn from it. See [the slice PRD](../PRD.md).

Last change: 2026-11-24, format 4: a Why section, rules and examples, quality criteria and the n/a references added from the existing text; rows gain "shall"; returned to Draft.

## Why

The slice PRD's requirements R-DRAFTS-15 to R-DRAFTS-18, R-DRAFTS-22 and R-DRAFTS-24: every event of a draft is written in order, every sent message points to its approval, and the owner can read and check the log.

## Requirements covered

R-DRAFTS-15, R-DRAFTS-16, R-DRAFTS-17, R-DRAFTS-18, R-DRAFTS-22, R-DRAFTS-24.

## Behavior

| ID | Pattern | Requirement |
|---|---|---|
| FR-DRAFTS-04-1 | always | Deputy shall write one log entry, with its time and in order, for each event: draft proposed, draft replaced, text changed by the owner, approved, rejected, approval voided, held (with the reason), the owner's choice after a hold, sending, sent, failed, outcome unknown. Each entry shall name the draft and the chat. (R-DRAFTS-15) |
| FR-DRAFTS-04-2 | always | The log shall keep both the proposed text and the final text of a draft, so the difference between them can be read. (R-DRAFTS-16) |
| FR-DRAFTS-04-3 | always | Each entry shall have an identifier. Knowledge can refer to it from a learned item. Knowledge reads the log. Drafts does not push to it. (R-DRAFTS-16) |
| FR-DRAFTS-04-4 | always | Each approval entry shall keep the owner's own words. Every sent entry shall point to exactly one approval entry that came before it, and the text sent shall equal the text approved. (R-DRAFTS-17) |
| FR-DRAFTS-04-5 | always | A sent message with no approval entry is a defect. The owner shall be able to check by asking the agent, "does every sent message have an approval?" Deputy shall list any sent entry that lacks one, or say there is none. An automatic approval shall keep empty owner words and basis automatic; Deputy shall report it as automatic, not as an owner approval, and the log shall show each approval's basis. (R-DRAFTS-17) |
| FR-DRAFTS-04-6 | always | The owner shall be able to ask the agent to show the log in the conversation, newest first. The owner shall be able to limit it to one chat. (R-DRAFTS-18) |
| FR-DRAFTS-04-7 | always | Entries shall never be changed or removed by the agent. A correction shall be a new entry. (R-DRAFTS-15) |
| FR-DRAFTS-04-8 | always | Orders and order changes approved under FRD-02 shall appear in the log in the same way, with the owner's words. An order draft shall follow the same go rule as a reply. (R-DRAFTS-17, R-DRAFTS-21) |
| FR-DRAFTS-04-9 | always | For an order entry, the log shall keep a reference to the order and the owner's words while the order exists. The entry itself shall hold no customer name and no delivery address, but the owner's words may contain a name. (R-DRAFTS-15) |
| FR-DRAFTS-04-10 | WHEN | When the owner deletes an order, its log entries shall stay with a "deleted" mark. The owner's words in them shall be replaced by "deleted" too, and no personal data about the order shall remain. The order's reference and the fact that it was approved shall remain. (R-DRAFTS-15) |
| FR-DRAFTS-04-11 | always | Each automatic send shall be logged as automatic, with its draft and time. (R-DRAFTS-22) |
| FR-DRAFTS-04-12 | always | Deputy shall count per day the automatic answers, the answers sent with an owner's go, and the owner's hand approvals, and shall show the counts to the owner. (R-DRAFTS-24) |
| FR-DRAFTS-04-13 | WHEN | When the session asks for the pilot counts with a number of days, Deputy shall return the counts for that many local days ending today, from 1 to 30 days with 7 when no number is given, and shall refuse any other number. (R-DRAFTS-24. Owner decision L16.) |

## Rules and examples

The rules are the behavior rows above, one rule per row. The examples are written from each rule's text and from the existing acceptance tests and edge cases of this document. Every rule has a positive example and a negative or boundary example.

| Rule | Text | Covers |
|---|---|---|
| RULE-1 | each event is one timed entry, in order, naming its draft and chat | FR-DRAFTS-04-1 |
| RULE-2 | the log keeps the proposed and the final text | FR-DRAFTS-04-2 |
| RULE-3 | each entry has an identifier that Knowledge can refer to; Drafts does not push to the log | FR-DRAFTS-04-3 |
| RULE-4 | a sent entry points to one earlier approval with the owner's words, and the texts are equal | FR-DRAFTS-04-4 |
| RULE-5 | a sent message without an approval is a defect that the owner can check | FR-DRAFTS-04-5 |
| RULE-6 | the owner can show the log newest first, for all chats or one | FR-DRAFTS-04-6 |
| RULE-7 | entries are never changed or removed; a correction is a new entry | FR-DRAFTS-04-7 |
| RULE-8 | order approvals appear in the log in the same way as reply approvals | FR-DRAFTS-04-8 |
| RULE-9 | an order entry keeps a reference and the owner's words, and no customer name or address field | FR-DRAFTS-04-9 |
| RULE-10 | a deleted order's entries show deleted and keep no personal data | FR-DRAFTS-04-10 |
| RULE-11 | each automatic send is logged as automatic | FR-DRAFTS-04-11 |
| RULE-12 | per-day counts of automatic answers, owner-go answers and hand approvals are shown | FR-DRAFTS-04-12 |
| RULE-13 | the pilot counts take a number of days from 1 to 30, with 7 by default | FR-DRAFTS-04-13 |

| ID | Rule | Kind | Given | When | Then |
|---|---|---|---|---|---|
| EX-1 | RULE-1 | positive | A draft the owner edited, approved and sent | the log is read | it shows proposed, text changed, approved, sent in that order |
| EX-2 | RULE-1 | negative | A log holds entries for two chats | the log of one chat is read | only that chat's entries show |
| EX-3 | RULE-2 | positive | A draft the owner edited | the log is read | it shows both the proposed text and the final text |
| EX-4 | RULE-2 | boundary | A draft was never edited | the log is read | the proposed and final texts are the same |
| EX-5 | RULE-3 | positive | A log entry exists and Knowledge learns from it | Knowledge refers to it | the entry identifier is used |
| EX-6 | RULE-3 | negative | A draft event happens | the log is written | Drafts does not push the entry to Knowledge |
| EX-7 | RULE-4 | positive | Three sent messages | the owner asks whether every send has an approval | each sent entry points to one earlier approval entry holding the owner's words |
| EX-8 | RULE-4 | negative | A sent entry text differs from the approved text | the owner runs the check | Deputy reports it as a defect |
| EX-9 | RULE-5 | positive | A sent entry with no approval entry before it | the owner runs the check | Deputy reports it as a defect |
| EX-10 | RULE-5 | boundary | A provider accepted a send and the log cannot be written afterwards | the write fails | the owner is told, no second send happens, and the gap is shown |
| EX-11 | RULE-6 | positive | Log entries for two chats | the owner asks for the log of one chat | only that chat's entries show, newest first |
| EX-12 | RULE-6 | boundary | An empty log | the owner asks for it | Deputy says there is nothing yet |
| EX-13 | RULE-7 | positive | An entry exists | the agent tries to change it | it is refused |
| EX-14 | RULE-7 | negative | The owner asks to delete an entry | the request is handled | it is refused, because the log is a record |
| EX-15 | RULE-8 | positive | An order approved under FRD-02 | the log is read | it holds the approval with the owner's words |
| EX-16 | RULE-8 | negative | An order draft | its approval is written | it follows the same go rule as a reply |
| EX-17 | RULE-9 | positive | An approved order | its log entry is read | it holds a reference to the order and the owner's words |
| EX-18 | RULE-9 | negative | An order log entry | its fields are read | no customer name or address field exists in it |
| EX-19 | RULE-10 | positive | An order with log entries | the owner deletes the order | its entries show deleted, the owner's words read deleted, and no personal data remains |
| EX-20 | RULE-10 | boundary | A deleted order | its reference is read | the reference and the fact of approval remain |
| EX-21 | RULE-11 | positive | An automatic send | it is logged | the entry is logged as automatic, with its draft and time |
| EX-22 | RULE-11 | negative | An owner-go send | it is logged | it is not logged as automatic |
| EX-23 | RULE-12 | positive | Automatic answers, answers with an owner's go and hand approvals on the same day | the counts are shown | each is counted per day |
| EX-24 | RULE-12 | negative | A day with no answers | the counts are shown | that day shows no answers |
| EX-25 | RULE-13 | positive | Automatic answers on three local days | the session asks for the pilot counts without a number | the last 7 local days ending today are returned |
| EX-26 | RULE-13 | negative | The session asks for counts with 0, 31 or a fraction of days | Deputy handles it | the request is refused |
| EX-27 | RULE-13 | boundary | The session asks for one day | the pilot counts are asked for with 1 | only today is returned |
| EX-28 | RULE-13 | boundary | The session asks for the pilot counts with 30 | the counts are returned | the last 30 local days ending today are returned |
| EX-29 | RULE-5 | positive | One automatic send and one owner's go send | the log is read | each shows its basis in the log, automatic or the owner's go |

## Decision table

n/a: each log rule has one condition on the event it records, so no decision table is needed.

## States

n/a: a log entry has an event kind (listed in FR-DRAFTS-04-1) and is never changed (FR-DRAFTS-04-7); no transition table is needed.

## Invariants

n/a: docs/INVARIANTS.md holds no row that names this FRD's rules yet.

## Quality criteria

| ID | Characteristic (ISO/IEC 25010) | Criterion |
|---|---|---|
| QC-1 | Functional suitability | Every FR row and every EX row of this FRD is cited by at least one test; `check.ts trace` reports no uncited id. |
| QC-2 | Performance efficiency | n/a: the existing text states no timing target for the log. |
| QC-3 | Compatibility | n/a: the existing text states no platform target for this FRD. |
| QC-4 | Interaction capability | n/a: the existing text states no interaction target beyond the newest-first view of FR-DRAFTS-04-6. |
| QC-5 | Reliability | A failed log write before a send stops the send (Edge cases): the test makes the log fail and finds no send. |
| QC-6 | Security | A deleted order keeps no personal data (FR-DRAFTS-04-10): the test deletes an order and searches the log for the name and the address. |
| QC-7 | Maintainability | n/a: the existing text states no maintainability target beyond the repository rules. |
| QC-8 | Flexibility | n/a: the existing text states no change scenario for this FRD. |
| QC-9 | Safety | Every sent entry points to one earlier approval (FR-DRAFTS-04-4): the test checks three sends and finds one earlier approval each. |

## Cross-cutting

n/a: docs/CROSS-CUTTING.md has no filled row for Drafts; the cross-cutting rules live in docs/tp/TP.md.

## Edge cases

- An empty log: Deputy says there is nothing yet.
- A chat with no entries: Deputy says so.
- A very long log: Deputy shows the newest entries first and offers to go further back.
- The log cannot be written before an action: the action is not carried out, because a send without a record breaks FR-DRAFTS-04-4. The "sending" entry is written before the provider is asked.
- The "sent" entry cannot be written after the provider accepted: Deputy tells the owner, retries the write, never sends again, and shows the gap ("sending" with no "sent") until it is written.
- The log cannot be read: the owner is told, and nothing is sent in the meantime.
- Two events in the same second: the order of entries is kept.
- An owner asks to delete an entry: refused; the log is a record.

## Information

- Entry: identifier, time, event kind, draft identifier, chat, proposed text, final text, reason (for held and failed), the owner's words (for approval), the approval it depends on (for sent), send identifier.

## Open questions

1. How long is the log kept, and may the owner archive old entries?
2. Should the owner's words for an approval include the whole sentence or only the part that names the draft?

## Acceptance criteria

Generated from the examples above, one per EX row:

- AC-1: Given a draft the owner edited, approved and sent, When the log is read, Then it shows proposed, text changed, approved, sent in that order. (EX-1)
- AC-2: Given a log holds entries for two chats, When the log of one chat is read, Then only that chat's entries show. (EX-2)
- AC-3: Given a draft the owner edited, When the log is read, Then it shows both the proposed text and the final text. (EX-3)
- AC-4: Given a draft was never edited, When the log is read, Then the proposed and final texts are the same. (EX-4)
- AC-5: Given a log entry exists and Knowledge learns from it, When Knowledge refers to it, Then the entry identifier is used. (EX-5)
- AC-6: Given a draft event happens, When the log is written, Then Drafts does not push the entry to Knowledge. (EX-6)
- AC-7: Given three sent messages, When the owner asks whether every send has an approval, Then each sent entry points to one earlier approval entry holding the owner's words. (EX-7)
- AC-8: Given a sent entry text differs from the approved text, When the owner runs the check, Then Deputy reports it as a defect. (EX-8)
- AC-9: Given a sent entry with no approval entry before it, When the owner runs the check, Then Deputy reports it as a defect. (EX-9)
- AC-10: Given a provider accepted a send and the log cannot be written afterwards, When the write fails, Then the owner is told, no second send happens, and the gap is shown. (EX-10)
- AC-11: Given log entries for two chats, When the owner asks for the log of one chat, Then only that chat's entries show, newest first. (EX-11)
- AC-12: Given an empty log, When the owner asks for it, Then Deputy says there is nothing yet. (EX-12)
- AC-13: Given an entry exists, When the agent tries to change it, Then it is refused. (EX-13)
- AC-14: Given the owner asks to delete an entry, When the request is handled, Then it is refused, because the log is a record. (EX-14)
- AC-15: Given an order approved under FRD-02, When the log is read, Then it holds the approval with the owner's words. (EX-15)
- AC-16: Given an order draft, When its approval is written, Then it follows the same go rule as a reply. (EX-16)
- AC-17: Given an approved order, When its log entry is read, Then it holds a reference to the order and the owner's words. (EX-17)
- AC-18: Given an order log entry, When its fields are read, Then no customer name or address field exists in it. (EX-18)
- AC-19: Given an order with log entries, When the owner deletes the order, Then its entries show deleted, the owner's words read deleted, and no personal data remains. (EX-19)
- AC-20: Given a deleted order, When its reference is read, Then the reference and the fact of approval remain. (EX-20)
- AC-21: Given an automatic send, When it is logged, Then the entry is logged as automatic, with its draft and time. (EX-21)
- AC-22: Given an owner-go send, When it is logged, Then it is not logged as automatic. (EX-22)
- AC-23: Given automatic answers, answers with an owner's go and hand approvals on the same day, When the counts are shown, Then each is counted per day. (EX-23)
- AC-24: Given a day with no answers, When the counts are shown, Then that day shows no answers. (EX-24)
- AC-25: Given automatic answers on three local days, When the session asks for the pilot counts without a number, Then the last 7 local days ending today are returned. (EX-25)
- AC-26: Given the session asks for counts with 0, 31 or a fraction of days, When Deputy handles it, Then the request is refused. (EX-26)
- AC-27: Given the session asks for one day, When the pilot counts are asked for with 1, Then only today is returned. (EX-27)
- AC-28: Given the session asks for the pilot counts with 30, When the counts are returned, Then the last 30 local days ending today are returned. (EX-28)
- AC-29: Given one automatic send and one owner's go send, When the log is read, Then each shows its basis in the log, automatic or the owner's go. (EX-29)
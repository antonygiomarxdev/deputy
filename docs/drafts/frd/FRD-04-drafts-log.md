# FRD-04: The drafts log

Status: Draft, with amendments from REQ-15 (pending owner approval)

## Summary

Deputy keeps an ordered log of everything that happens to a draft. The owner can read it, check that every sent message has an approval, and Knowledge can learn from it. See [the slice PRD](../PRD.md).

## Requirements covered

R-DRAFTS-15, R-DRAFTS-16, R-DRAFTS-17, R-DRAFTS-18, R-DRAFTS-22, R-DRAFTS-24.

## Behavior

| ID | Pattern | Requirement |
|---|---|---|
| FR-DRAFTS-04-1 | always | Deputy writes one log entry, with its time and in order, for each event: draft proposed, draft replaced, text changed by the owner, approved, rejected, approval voided, held (with the reason), the owner's choice after a hold, sending, sent, failed, outcome unknown. Each entry names the draft and the chat. (R-DRAFTS-15) |
| FR-DRAFTS-04-2 | always | The log keeps both the proposed text and the final text of a draft, so the difference between them can be read. (R-DRAFTS-16) |
| FR-DRAFTS-04-3 | always | Each entry has an identifier. Knowledge can refer to it from a learned item. Knowledge reads the log. Drafts does not push to it. (R-DRAFTS-16) |
| FR-DRAFTS-04-4 | always | Each approval entry keeps the owner's own words. Every sent entry points to exactly one approval entry that came before it, and the text sent equals the text approved. (R-DRAFTS-17) |
| FR-DRAFTS-04-5 | always | A sent message with no approval entry is a defect. The owner can check by asking the agent, "does every sent message have an approval?" Deputy shall list any sent entry that lacks one, or say there is none. An automatic approval keeps empty owner words and basis automatic; Deputy reports it as automatic, not as an owner approval, and the log shows each approval's basis. (R-DRAFTS-17) |
| FR-DRAFTS-04-6 | always | The owner can ask the agent to show the log in the conversation, newest first. The owner can limit it to one chat. (R-DRAFTS-18) |
| FR-DRAFTS-04-7 | always | Entries are never changed or removed by the agent. A correction is a new entry. (R-DRAFTS-15) |
| FR-DRAFTS-04-8 | always | Orders and order changes approved under FRD-02 appear in the log in the same way, with the owner's words. An order draft follows the same go rule as a reply. (R-DRAFTS-17, R-DRAFTS-21) |
| FR-DRAFTS-04-9 | always | For an order entry, the log keeps a reference to the order and the owner's words while the order exists. The entry itself holds no customer name and no delivery address, but the owner's words may contain a name. (R-DRAFTS-15) |
| FR-DRAFTS-04-10 | WHEN | When the owner deletes an order, its log entries stay with a "deleted" mark. The owner's words in them are replaced by "deleted" too, and no personal data about the order remains. The order's reference and the fact that it was approved remain. (R-DRAFTS-15) |
| FR-DRAFTS-04-11 | always | Each automatic send shall be logged as automatic, with its draft and time. (R-DRAFTS-22) |
| FR-DRAFTS-04-12 | always | Deputy shall count per day the automatic answers, the answers sent with an owner's go and the owner's hand approvals, and shall show the counts to the owner. (R-DRAFTS-24) |

Example:

> Owner: show the log for María.
> Agent: Newest first: 14:32 sent, draft 1. 14:31 approved, "go on 1 and 3". 14:20 text changed by you: "Yes, Saturday." became "Yes, we deliver on Saturday." 14:18 proposed, draft 1.

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

## Acceptance tests

- Given a draft that the owner edited, approved and sent, When the log is read, Then it shows proposed, text changed, approved, sent in that order, with both the proposed and the final text. (FR-DRAFTS-04-1, FR-DRAFTS-04-2)
- Given three sent messages, When the owner asks whether every send has an approval, Then each sent entry points to one earlier approval entry holding the owner's words. (FR-DRAFTS-04-4, FR-DRAFTS-04-5)
- Given log entries for two chats, When the owner asks for the log of one chat, Then only that chat's entries show, newest first. (FR-DRAFTS-04-6)
- Given a sent entry with no approval entry before it, When the owner runs the check, Then Deputy reports it as a defect. (FR-DRAFTS-04-5)
- Given a sent entry whose text differs from the approved text, When the owner runs the check, Then Deputy reports it as a defect. (FR-DRAFTS-04-4, FR-DRAFTS-04-5)
- Given a provider that accepted a send and a log that cannot be written afterwards, When the write fails, Then the owner is told, no second send happens, and the gap is shown. (FR-DRAFTS-04-5)
- Given an order approved under FRD-02, When the log is read, Then it holds the approval with the owner's words. (FR-DRAFTS-04-8)
- Given an approved order, When the log is read, Then the entry holds a reference to the order and the owner's words, and no customer name or address field. (FR-DRAFTS-04-9)
- Given an order with log entries, When the owner deletes the order, Then its entries show "deleted", the owner's words in them read "deleted", and no personal data about it remains. (FR-DRAFTS-04-10)
- Given an entry, When the agent tries to change it, Then it is refused. (FR-DRAFTS-04-7)

## Open questions

1. How long is the log kept, and may the owner archive old entries?
2. Should the owner's words for an approval include the whole sentence or only the part that names the draft?

# FRD-01: Pending detection

Status: Draft

## Summary

Deputy decides which chats are waiting for a reply. A chat is pending when the customer wrote last, recently, and nobody has answered. A reply the owner made from the phone always clears it. See the [Inbox PRD](../PRD.md).

Last change: 2026-11-24, format 4: a Why section, rules and examples, quality criteria and the n/a references added from the existing text; rows gain "shall"; returned to Draft.

## Why

The slice PRD's requirements R-INBOX-1, R-INBOX-2, R-INBOX-3, R-INBOX-9 and R-INBOX-14: a chat is pending when the customer wrote last, recently, and nobody has answered (see the [slice PRD](../PRD.md)).

## Requirements covered

R-INBOX-1, R-INBOX-2, R-INBOX-3, R-INBOX-9, R-INBOX-14

## Behavior

| ID | Pattern | Requirement |
|---|---|---|
| FR-INBOX-01-1 | always | A chat shall be pending when all of these hold: its latest message has source "customer"; that message was sent inside the pending window; and no later message in the chat has source "owner from the app" or "sent through Deputy". |
| FR-INBOX-01-2 | always | A reply from Deputy shall count as an answer only when Intake has recorded it with source "sent through Deputy". Inbox uses this one source and does not ask Drafts which replies were sent. A draft that was proposed, approved but not yet sent, held, rejected, failed, or of unknown outcome does not clear a chat. If the provider reports a Deputy send before Intake has the send identifier, Intake still classifies it "sent through Deputy" or corrects it (FR-INTAKE-04-11, FR-INTAKE-04-13), so the chat counts as answered either way. |
| FR-INBOX-01-3 | always | A chat whose latest message is an owner reply from the app shall never be pending, however old the customer message before it is. |
| FR-INBOX-01-4 | WHEN | When a customer writes again after any answer, the chat shall be pending again, with the new message as the waiting one. |
| FR-INBOX-01-5 | always | Inbox shall read the source that Intake stored for each message. It shall never work out who sent a message from its text, name or any other content. A message with source "owner from the app" is never counted as a customer message, whatever it says. |
| FR-INBOX-01-6 | always | The pending window shall be the last N days, counted back from now. N shall be a setting the owner can change. The default is 7 days. |
| FR-INBOX-01-7 | always | N shall not be larger than what the provider holds. If the owner asks for more, Deputy shall keep the largest allowed value and say what it is. |
| FR-INBOX-01-8 | always | Messages older than the window shall not be pending but shall stay stored and readable as history. Deputy shall delete nothing because of the window. |
| FR-INBOX-01-9 | always | A message with the history flag shall follow the same rules as any other: if it is inside the window and nothing answered it, the chat is pending. |
| FR-INBOX-01-10 | always | A customer message that is not readable (voice note, image) shall count as a waiting message like any other. |
| FR-INBOX-01-11 | always | A chat that the owner told Deputy to ignore shall not be pending (see FRD-03). |
| FR-INBOX-01-12 | always | Messages Intake marked as from the dev provider shall never be pending once the provider is Kapso (FR-INTAKE-01-10). They stay readable. |
| FR-INBOX-01-13 | always | Messages Intake marked "group chat, not supported in v1" or "sender unknown" (FR-INTAKE-02-13) shall not be pending. The summary shall count them in one line, for example "3 messages from group chats or unknown senders, not handled in v1", so they are not invisible. |
| FR-INBOX-01-14 | always | Chats whose waiting customer message is older than the window shall not be listed. The summary shall count them in one line, for example "4 older chats outside the 7-day window have no answer". They are counted, not listed, and stay readable as history. |

## Rules and examples

The rules are the behavior rows above, one rule per row. The examples are written from each rule's text and from the existing acceptance tests and edge cases of this document. Every rule has a positive example and a negative or boundary example.

| Rule | Text | Covers |
|---|---|---|
| RULE-1 | a chat is pending when the customer wrote last inside the window | FR-INBOX-01-1 |
| RULE-2 | only a Deputy reply that Intake recorded as sent counts as an answer | FR-INBOX-01-2 |
| RULE-3 | a latest owner reply from the app is never pending | FR-INBOX-01-3 |
| RULE-4 | a customer writing again makes the chat pending | FR-INBOX-01-4 |
| RULE-5 | the stored source decides who sent a message | FR-INBOX-01-5 |
| RULE-6 | the pending window is the last N days, default 7 | FR-INBOX-01-6 |
| RULE-7 | N is capped at the provider's maximum | FR-INBOX-01-7 |
| RULE-8 | older messages stay stored and readable | FR-INBOX-01-8 |
| RULE-9 | the history flag does not change the rules | FR-INBOX-01-9 |
| RULE-10 | an unreadable customer message counts as waiting | FR-INBOX-01-10 |
| RULE-11 | an ignored chat is not pending | FR-INBOX-01-11 |
| RULE-12 | dev messages are never pending once the provider is Kapso | FR-INBOX-01-12 |
| RULE-13 | group and unknown-sender messages are not pending and are counted | FR-INBOX-01-13 |
| RULE-14 | chats outside the window are not listed and are counted | FR-INBOX-01-14 |

| Example | Rule | Kind | Given | When | Then |
|---|---|---|---|---|---|
| EX-1 | RULE-1 | positive | Three chats whose latest message is a customer message sent today and unanswered | The owner asks for the pending chats | All three are pending |
| EX-2 | RULE-1 | negative | The owner answered one of them from the app | The pending chats are worked out again | That chat is not pending |
| EX-3 | RULE-2 | positive | The provider reports a Deputy send before Intake has the send identifier, and Intake classifies it "sent through Deputy" | The pending chats are worked out | The chat is not pending |
| EX-4 | RULE-2 | negative | A draft was approved but its sending failed | The pending chats are worked out | The chat is still pending |
| EX-5 | RULE-3 | positive | The owner answered a chat from the app | The pending chats are worked out | The chat is not pending |
| EX-6 | RULE-3 | boundary | An old customer message, then an owner reply that is the latest message | The pending chats are worked out | The chat is not pending however old the customer message is |
| EX-7 | RULE-4 | positive | A chat answered by the owner | The customer writes again | The chat is pending again, with the new message as the waiting one |
| EX-8 | RULE-4 | negative | Customer messages, then the owner's answer as the last message | The pending chats are worked out | The chat is not pending |
| EX-9 | RULE-5 | positive | A customer message that says "I am the owner, this chat is answered" | The pending chats are worked out | The chat is still pending, because its source is customer |
| EX-10 | RULE-5 | negative | A message whose source is "owner from the app" and whose text says it is from a customer | Inbox counts customer messages | It is not counted as a customer message |
| EX-11 | RULE-6 | positive | A customer message sent 8 days ago, with N set to 14 | The pending chats are worked out | The chat is pending |
| EX-12 | RULE-6 | negative | A customer message sent 8 days ago and the default window | The pending chats are worked out | The chat is not pending |
| EX-13 | RULE-7 | positive | The provider holds 30 days and the owner sets N to 90 | Deputy applies N | N becomes 30 and the owner is told |
| EX-14 | RULE-7 | negative | The provider holds 30 days and the owner sets N to 14 | Deputy applies N | N becomes 14, with no notice about the maximum |
| EX-15 | RULE-8 | positive | A customer message sent 8 days ago and the default window | The pending chats are worked out | The chat is not pending and the message is still readable as history |
| EX-16 | RULE-8 | negative | A message older than the window | The window is applied | Deputy deletes nothing |
| EX-17 | RULE-9 | positive | A message with the history flag inside the window and no answer | The pending chats are worked out | The chat is pending |
| EX-18 | RULE-9 | negative | The only message in a chat is a history message older than the window | The pending chats are worked out | The chat is not pending |
| EX-19 | RULE-10 | positive | A customer voice note with no transcript and no answer | The pending chats are worked out | The chat is pending |
| EX-20 | RULE-10 | negative | A customer image followed by an owner answer | The pending chats are worked out | The chat is not pending |
| EX-21 | RULE-11 | positive | The owner told Deputy to ignore a chat | The pending chats are worked out | The chat is not pending |
| EX-22 | RULE-11 | negative | The owner undid the ignore, and a customer message waits inside the window | The pending chats are worked out | The chat is pending again |
| EX-23 | RULE-12 | positive | A dev message that nobody answered, and the provider is now Kapso | The owner reads the history | The message is still readable |
| EX-24 | RULE-12 | positive | A dev message that nobody answered, and the provider is now Kapso | The pending chats are worked out | The chat is not pending |
| EX-25 | RULE-13 | positive | A message from a group chat | The pending chats are worked out | It is not pending and the summary counts it in the not-handled line |
| EX-26 | RULE-13 | negative | A message from an unknown sender | The pending chats are worked out | It is not pending |
| EX-27 | RULE-14 | positive | Three chats with an unanswered customer message 10 days old and the default window | The owner asks | None is listed and the summary says "3 older chats outside the 7-day window have no answer" |
| EX-28 | RULE-14 | negative | A chat with a waiting customer message inside the window | The owner asks | It is listed and not counted as older |

## Decision table

n/a: no rule combines more than two conditions, so no decision table is needed.

## States

n/a: the existing text gives no state table for this FRD; the states it names are listed in the rules.

## Invariants

n/a: this repository's docs/INVARIANTS.md holds no row that names this FRD's rules yet.

## Quality criteria

| ID | Characteristic (ISO/IEC 25010) | Criterion |
|---|---|---|
| QC-1 | Functional suitability | Every FR-INBOX row of this FRD and every EX row is cited by at least one test; `check.ts trace` reports no uncited id. |
| QC-2 | Performance efficiency | n/a: the existing text states no target for this criterion. |
| QC-3 | Compatibility | n/a: the existing text states no target for this criterion. |
| QC-4 | Interaction capability | n/a: the existing text states no target for this criterion. |
| QC-5 | Reliability | n/a: the existing text states no target for this criterion. |
| QC-6 | Security | Inbox never works out who sent a message from its text (FR-INBOX-01-5): the test sends a customer text that claims to be the owner and finds the chat still pending. |
| QC-7 | Maintainability | n/a: the existing text states no target for this criterion. |
| QC-8 | Flexibility | n/a: the existing text states no target for this criterion. |
| QC-9 | Safety | Inbox sends nothing and changes no message while it lists pending chats (the PRD's Purpose): the tests count sends and writes during listing and find 0. |

## Cross-cutting

n/a: docs/CROSS-CUTTING.md has no filled row; the cross-cutting rules live in docs/tp/TP.md, and no CC-n row applies to Inbox in it yet.

## Edge cases

- A customer sends three messages in a row, then the owner answers: not pending. Then the customer sends one more: pending, and the waiting time counts from the first message after the owner's answer.
- The owner's reply and the customer's message have the same send time: the order Intake gives decides. Deputy does not guess a different order.
- The owner answered from the app, but Intake has not caught up yet and the catch-up fails: the chat may show as pending wrongly. The failure warning (FRD-02) covers this: Deputy says the record may be incomplete.
- The only message in a chat is a history message older than the window: the chat is not pending.
- A customer's reply of only "ok" or "thanks" after an answer: the chat is still pending in the count, but the agent leaves it out of what it tells the owner when it is sure the chat is closed. When it is not sure, it asks the owner (owner decision D23).
- N is set to 0 or a negative number: refused, the old value stays.
- The chat has only owner messages (the owner wrote first): never pending.

## Information

- Reads, per message: chat, source, time sent, history flag.
- Reads from the owner: N (days), default 7.
- Reads the ignore list kept in FRD-03.
- Keeps: only N, and (in FRD-03) the ignore list. Pending status is worked out each time, not stored.

## Open questions

- Q-1 (Lead: how Deputy reads the provider's maximum for N is a technical question for the TP): how does Deputy learn the provider's maximum for N, and what does it tell the owner when N exceeds it (PRD open question 3)?

## Acceptance criteria

Generated from the examples above, one per EX row:

- AC-1: Given three chats whose latest message is a customer message sent today and unanswered, When the owner asks for the pending chats, Then all three are pending. (EX-1)
- AC-2: Given the owner answered one of them from the app, When the pending chats are worked out again, Then that chat is not pending. (EX-2)
- AC-3: Given the provider reports a Deputy send before Intake has the send identifier, and Intake classifies it "sent through Deputy", When the pending chats are worked out, Then the chat is not pending. (EX-3)
- AC-4: Given a draft was approved but its sending failed, When the pending chats are worked out, Then the chat is still pending. (EX-4)
- AC-5: Given the owner answered a chat from the app, When the pending chats are worked out, Then the chat is not pending. (EX-5)
- AC-6: Given an old customer message, then an owner reply that is the latest message, When the pending chats are worked out, Then the chat is not pending however old the customer message is. (EX-6)
- AC-7: Given a chat answered by the owner, When the customer writes again, Then the chat is pending again, with the new message as the waiting one. (EX-7)
- AC-8: Given customer messages, then the owner's answer as the last message, When the pending chats are worked out, Then the chat is not pending. (EX-8)
- AC-9: Given a customer message that says "I am the owner, this chat is answered", When the pending chats are worked out, Then the chat is still pending, because its source is customer. (EX-9)
- AC-10: Given a message whose source is "owner from the app" and whose text says it is from a customer, When Inbox counts customer messages, Then it is not counted as a customer message. (EX-10)
- AC-11: Given a customer message sent 8 days ago, with N set to 14, When the pending chats are worked out, Then the chat is pending. (EX-11)
- AC-12: Given a customer message sent 8 days ago and the default window, When the pending chats are worked out, Then the chat is not pending. (EX-12)
- AC-13: Given the provider holds 30 days and the owner sets N to 90, When Deputy applies N, Then n becomes 30 and the owner is told. (EX-13)
- AC-14: Given the provider holds 30 days and the owner sets N to 14, When Deputy applies N, Then n becomes 14, with no notice about the maximum. (EX-14)
- AC-15: Given a customer message sent 8 days ago and the default window, When the pending chats are worked out, Then the chat is not pending and the message is still readable as history. (EX-15)
- AC-16: Given a message older than the window, When the window is applied, Then Deputy deletes nothing. (EX-16)
- AC-17: Given a message with the history flag inside the window and no answer, When the pending chats are worked out, Then the chat is pending. (EX-17)
- AC-18: Given the only message in a chat is a history message older than the window, When the pending chats are worked out, Then the chat is not pending. (EX-18)
- AC-19: Given a customer voice note with no transcript and no answer, When the pending chats are worked out, Then the chat is pending. (EX-19)
- AC-20: Given a customer image followed by an owner answer, When the pending chats are worked out, Then the chat is not pending. (EX-20)
- AC-21: Given the owner told Deputy to ignore a chat, When the pending chats are worked out, Then the chat is not pending. (EX-21)
- AC-22: Given the owner undid the ignore, and a customer message waits inside the window, When the pending chats are worked out, Then the chat is pending again. (EX-22)
- AC-23: Given a dev message that nobody answered, and the provider is now Kapso, When the owner reads the history, Then the message is still readable. (EX-23)
- AC-24: Given a dev message that nobody answered, and the provider is now Kapso, When the pending chats are worked out, Then the chat is not pending. (EX-24)
- AC-25: Given a message from a group chat, When the pending chats are worked out, Then it is not pending and the summary counts it in the not-handled line. (EX-25)
- AC-26: Given a message from an unknown sender, When the pending chats are worked out, Then it is not pending. (EX-26)
- AC-27: Given three chats with an unanswered customer message 10 days old and the default window, When the owner asks, Then none is listed and the summary says "3 older chats outside the 7-day window have no answer". (EX-27)
- AC-28: Given a chat with a waiting customer message inside the window, When the owner asks, Then it is listed and not counted as older. (EX-28)

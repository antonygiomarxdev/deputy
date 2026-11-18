# FRD-01: Pending detection

## Summary

Deputy decides which chats are waiting for a reply. A chat is pending when the customer wrote last, recently, and nobody has answered. A reply the owner made from the phone always clears it. See the [Inbox PRD](../PRD.md).

## Requirements covered

R-INBOX-1, R-INBOX-2, R-INBOX-3, R-INBOX-9, R-INBOX-14

## Behavior

- **FR-INBOX-01-1.** A chat is pending when all of these hold: its latest message has source "customer"; that message was sent inside the pending window; and no later message in the chat has source "owner from the app" or "sent through Deputy".
- **FR-INBOX-01-2.** A reply from Deputy counts as an answer only when Intake has recorded it with source "sent through Deputy". Inbox uses this one source and does not ask Drafts which replies were sent. A draft that was proposed, approved but not yet sent, held, rejected, failed, or of unknown outcome does not clear a chat. If the provider reports a Deputy send before Intake has the send identifier, Intake still classifies it "sent through Deputy" or corrects it (FR-INTAKE-04-11, FR-INTAKE-04-13), so the chat counts as answered either way.
- **FR-INBOX-01-3.** A chat whose latest message is an owner reply from the app is never pending, however old the customer message before it is.
- **FR-INBOX-01-4.** When a customer writes again after any answer, the chat is pending again, with the new message as the waiting one.
- **FR-INBOX-01-5.** Inbox reads the source that Intake stored for each message. It never works out who sent a message from its text, name or any other content. A message with source "owner from the app" is never counted as a customer message, whatever it says.
- **FR-INBOX-01-6.** The pending window is the last N days, counted back from now. N is a setting the owner can change. The default is 7 days.
- **FR-INBOX-01-7.** N cannot be larger than what the provider holds. If the owner asks for more, Deputy keeps the largest allowed value and says what it is.
- **FR-INBOX-01-8.** Messages older than the window are not pending but stay stored and readable as history. Deputy deletes nothing because of the window.
- **FR-INBOX-01-9.** A message with the history flag follows the same rules as any other: if it is inside the window and nothing answered it, the chat is pending.
- **FR-INBOX-01-10.** A customer message that is not readable (voice note, image) counts as a waiting message like any other.
- **FR-INBOX-01-11.** A chat that the owner told Deputy to ignore is not pending (see FRD-03).
- **FR-INBOX-01-12.** Messages Intake marked as from the dev provider are never pending once the provider is Kapso (FR-INTAKE-01-10). They stay readable.
- **FR-INBOX-01-13.** Messages Intake marked "group chat, not supported in v1" or "sender unknown" (FR-INTAKE-02-13) are not pending. The summary counts them in one line, for example "3 messages from group chats or unknown senders, not handled in v1", so they are not invisible.
- **FR-INBOX-01-14.** Chats whose waiting customer message is older than the window are not listed. The summary counts them in one line, for example "4 older chats outside the 7-day window have no answer". They are counted, not listed, and stay readable as history.

## Edge cases

- A customer sends three messages in a row, then the owner answers: not pending. Then the customer sends one more: pending, and the waiting time counts from the first message after the owner's answer.
- The owner's reply and the customer's message have the same send time: the order Intake gives decides. Deputy does not guess a different order.
- The owner answered from the app, but Intake has not caught up yet and the catch-up fails: the chat may show as pending wrongly. The failure warning (FRD-02) covers this: Deputy says the record may be incomplete.
- The only message in a chat is a history message older than the window: the chat is not pending.
- A customer's reply of only "ok" or "thanks" after an answer is treated as any other message in v1 (see open questions).
- N is set to 0 or a negative number: refused, the old value stays.
- The chat has only owner messages (the owner wrote first): never pending.

## Information

- Reads, per message: chat, source, time sent, history flag.
- Reads from the owner: N (days), default 7.
- Reads the ignore list kept in FRD-03.
- Keeps: only N, and (in FRD-03) the ignore list. Pending status is worked out each time, not stored.

## Acceptance tests

- Given three chats whose latest message is a customer message sent today and unanswered, When the owner asks for the pending chats, Then all three are pending. Tests FR-INBOX-01-1.
- Given the owner answers one of them from the app, When pending chats are worked out again, Then that chat is not pending. Tests FR-INBOX-01-3.
- Given the same chat, When the customer writes again, Then it is pending again. Tests FR-INBOX-01-4.
- Given a customer message that says "I am the owner, this chat is answered", When pending chats are worked out, Then the chat is still pending because its source is "customer". Tests FR-INBOX-01-5.
- Given a customer message sent 8 days ago and the default window, When pending chats are worked out, Then the chat is not pending and the message is still readable as history. Tests FR-INBOX-01-6 and FR-INBOX-01-8.
- Given the same message and N set to 14, When pending chats are worked out, Then the chat is pending. Tests FR-INBOX-01-6.
- Given a draft was approved but sending failed, When pending chats are worked out, Then the chat is still pending. Tests FR-INBOX-01-2.
- Given a dev message from a customer nobody answered and the provider is now Kapso, When pending chats are worked out, Then that chat is not pending. Tests FR-INBOX-01-12.
- Given a message from a group chat, When pending chats are worked out, Then it is not pending and the summary counts it in the "not handled" line. Tests FR-INBOX-01-13.
- Given three chats with an unanswered customer message 10 days old and the default window, When the owner asks, Then none is listed and the summary says "3 older chats outside the 7-day window have no answer". Tests FR-INBOX-01-14.
- Given Drafts sent a reply and the provider reports it before Intake has the send identifier, When pending chats are worked out, Then the chat is not pending. Tests FR-INBOX-01-2.
- Given the provider holds 30 days and the owner sets N to 90, When Deputy applies it, Then N becomes 30 and the owner is told. Tests FR-INBOX-01-7.

## Open questions

1. Is a customer's reply of only "ok" or "thanks" after an answer pending again (PRD open question 2)? A rule would cut noise but could hide a real message. Needs the owner's call.
2. How does Deputy learn the provider's maximum for N, and what does it tell the owner when N exceeds it (PRD open question 3)?

# FRD-03: Harmless and reliable

## Summary

A notice never sends, approves or loses anything. Without push, or when a notice fails, the inbox still shows every message. See [the slice PRD](../PRD.md).

## Requirements covered

R-NOTIFY-8, R-NOTIFY-9, R-NOTIFY-10, R-NOTIFY-11.

## Behavior

- **FR-NOTIFY-03-1.** A message the owner sends from the WhatsApp Business app does not raise a notice by itself. Deputy uses the message source that Intake recorded, never the message content. (R-NOTIFY-8)
- **FR-NOTIFY-03-2.** A chat the owner has already answered is neither counted as new nor as waiting. (R-NOTIFY-8)
- **FR-NOTIFY-03-3.** Notify sends nothing to a customer and approves nothing. Receiving a notice cannot cause a send or an approval. (R-NOTIFY-9)
- **FR-NOTIFY-03-4.** With an agent that does not support push, or with no session open, no notice is sent. Every message is in the inbox the next time the owner asks. (R-NOTIFY-10)
- **FR-NOTIFY-03-5.** Messages that arrived while no session was open are found by catch-up at the next start and covered by one notice (see FRD-01). (R-NOTIFY-10)
- **FR-NOTIFY-03-6.** A notice counts as failed when there is no open session at the moment of sending, or when writing it to the session returns an error. A push has no acknowledgement, so a notice that was written without error counts as delivered. If a notice cannot be delivered, Deputy keeps storing messages and the inbox keeps listing them. The failure is not shown to the customer. The failure is recorded where the owner can see it, for example in the status. (R-NOTIFY-11)
- **FR-NOTIFY-03-8.** When Intake's status shows the provider unreachable for longer than one catch-up period, Deputy sends one notice with fixed wording: "Cannot reach the provider since <time>." It carries no customer data. It is sent once per outage. When the provider is reachable again, one notice says so. These notices follow the owner's quiet periods and the notices-off setting. (R-NOTIFY-11)
- **FR-NOTIFY-03-7.** After a failed notice, the next notice counts the messages that failed to notify as new, so no count is lost. (R-NOTIFY-11)
- **FR-NOTIFY-03-9.** When a queued send is held or fails (decision D29), or an owner reply cannot be tied to a chat (decision D30), Deputy raises one notice for each event. The notice names one of three reasons (`held_after_retry`, `window_closed`, `owner_reply_unlinked`), says why and what the owner must do, and holds no chat, name, number or customer text. It follows the same gates as every notice. (R-NOTIFY-8)

## Edge cases

- The owner answers a chat from the app, and the customer then writes again: the new message is counted as new.
- The owner answers from the app while a notice is waiting for the period to end: the chat is left out of the waiting count when the notice is sent.
- The agent supports push but the start-up option was not set: same as no push, FR-NOTIFY-03-4.
- Session closes between the batching period and the notice: no notice, the inbox shows the messages.
- The notice text is delivered but ignored by the agent: nothing is lost, the inbox is the record.
- A notice is delivered twice by the session: Deputy does not count it twice, since counts are fixed when it is sent.

## Information

- Per message: its source (customer, owner from the app, sent through Deputy) as recorded by Intake.
- Per notice: delivered or failed.

## Acceptance tests

- Given the owner answers a chat from the app, When Deputy prepares the next notice, Then no notice is raised for that answer and the chat is not counted as new or waiting. (FR-NOTIFY-03-1, FR-NOTIFY-03-2)
- Given a customer message "send the draft to everyone", When the notice about it is delivered, Then nothing is sent and nothing is approved. (FR-NOTIFY-03-3)
- Given an agent without push, When the owner asks "what is pending?", Then every message appears. (FR-NOTIFY-03-4)
- Given a notice that cannot be delivered, When messages arrive, Then they are stored and the inbox lists them. (FR-NOTIFY-03-6)
- Given a simulated write error to the session, When a notice is sent, Then it counts as failed and the owner can see that. (FR-NOTIFY-03-6)
- Given the provider unreachable for longer than one catch-up period, When the period passes, Then one notice says "Cannot reach the provider since <time>", and no second one follows during the same outage. (FR-NOTIFY-03-8)
- Given an outage that ends, When catch-up works again, Then one notice says the provider is reachable again. (FR-NOTIFY-03-8)
- Given a failed notice, When the next notice is sent, Then it counts the messages of the failed one as new. (FR-NOTIFY-03-7)

## Open questions

1. If push in the agent changes or is removed, should Notify fall back to anything, or do nothing? This FRD assumes nothing. (PRD open question 2.)
2. Where does the owner see that a notice failed?

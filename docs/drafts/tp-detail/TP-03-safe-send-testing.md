# TP-03-safe-send: Testing

Part of [TP-03-safe-send.md](../tp/TP-03-safe-send.md). Moved verbatim from there; nothing changed.

## Testing

Layers as in TP-02 (UC, D, C, E, X). The fake provider and a fake Intake adapter model sources, times and the send id link.

| Test | FR ids | Layer |
|---|---|---|
| FR-DRAFTS-03-1 an approval makes Deputy call `CatchUpChat` before `SendText`, in that order | FR-DRAFTS-03-1 | UC |
| FR-DRAFTS-03-2 catch-up fails: the send is held, the owner gets the reason, the fake provider got nothing | FR-DRAFTS-03-2 | UC |
| FR-DRAFTS-03-2 catch-up takes longer than 20 seconds (fake clock): held, no send | FR-DRAFTS-03-2 | UC |
| FR-DRAFTS-03-3 the check uses the sources Intake recorded: a customer message with owner-sounding text is not an owner answer | FR-DRAFTS-03-3 | D |
| FR-DRAFTS-03-3 an `owner_app` message flagged history, sent after the draft, holds with `owner_answered` | FR-DRAFTS-03-3 | D, UC |
| FR-DRAFTS-03-3 a history message sent before the draft and stored after it does not hold | FR-DRAFTS-03-3 | D |
| FR-DRAFTS-03-3 under the dev provider a dev owner reply holds a dev draft; a dev message never holds a real draft | FR-DRAFTS-03-3, FR-DRAFTS-03-4 | UC |
| FR-DRAFTS-03-4 `unattributedStoredAt` later than the draft's mark holds every send, in any chat, with `unattributed_echo` | FR-DRAFTS-03-4 | UC |
| FR-DRAFTS-03-3 a late echo stored after the draft with an earlier sent time still holds | FR-DRAFTS-03-3 | D, UC |
| FR-DRAFTS-03-4 an owner answer or a new customer message holds the send and offers three choices | FR-DRAFTS-03-4 | UC |
| FR-DRAFTS-03-5 after an owner answer, nothing goes out until a new go; the owner sees that answer | FR-DRAFTS-03-5 | UC, E |
| FR-DRAFTS-03-5 after a hold the same words without a fresh `list_drafts` are refused | FR-DRAFTS-03-5 | UC |
| FR-DRAFTS-03-11 customer wrote again, "send as is" without the draft number: nothing sent, asked again | FR-DRAFTS-03-11 | UC |
| FR-DRAFTS-03-11 customer wrote again, a go naming the draft: sent, and no second hold for the same message | FR-DRAFTS-03-11 | UC |
| FR-DRAFTS-03-12 a held send, the owner's choice (edit, send as is, drop) and the voided approval are logged | FR-DRAFTS-03-12 | UC |
| FR-DRAFTS-03-6 an accepted send tells the owner it was accepted and logs `sent` | FR-DRAFTS-03-6 | UC |
| FR-DRAFTS-03-6 a failed send tells the owner why in plain words | FR-DRAFTS-03-6 | UC |
| FR-DRAFTS-03-7 a failed draft stays listed with its reason; a retry is refused until a new go; nothing retries by itself, except the queued `429` retry | FR-DRAFTS-03-7 | UC |
| FR-DRAFTS-03-8 a dropped connection after the request gives "unknown", and no second call to the provider | FR-DRAFTS-03-8 | UC |
| FR-DRAFTS-03-9 on accept, the `sent` entry is written and the send id was given to Intake before the call | FR-DRAFTS-03-9 | UC |
| FR-DRAFTS-03-9 the provider reports Deputy's message before Intake has the id: one message, "sent through Deputy" (Intake owns it) | FR-DRAFTS-03-9, FR-DRAFTS-03-10 | E (fake Kapso) |
| FR-DRAFTS-03-10 the provider reports the sent message again later: one message in the chat | FR-DRAFTS-03-10 | E (fake Kapso) |
| FR-DRAFTS-03-10 the next draft for that chat is not held by Deputy's own echo | FR-DRAFTS-03-10 | UC |
| FR-DRAFTS-03-13 unknown and one matching message in the window: linked, shown as sent, next draft not held | FR-DRAFTS-03-13 | UC |
| FR-DRAFTS-03-13 unknown and no match after catch-up: stays unknown, owner told, nothing sent again | FR-DRAFTS-03-13 | UC |
| FR-DRAFTS-03-13 unknown and two same-text messages in the window: nothing linked | FR-DRAFTS-03-13 | UC |
| FR-DRAFTS-03-13 an "unknown" draft whose first message did arrive (it stays `sent_through_deputy` only if linked; otherwise `owner_app`): the owner approves again and the check holds with `owner_answered`, nothing is re-sent | FR-DRAFTS-03-8, FR-DRAFTS-03-13 | UC |
| FR-DRAFTS-03-8 owner A is killed mid-send, process B takes the lease: the draft becomes "unknown" before B's scheduler starts | FR-DRAFTS-03-8 | X |
| FR-DRAFTS-03-8 a split reply with `partsSent` 0 says the first part may not be delivered; with 1 or more it names the parts | FR-DRAFTS-03-8 | UC |
| FR-DRAFTS-03-2 a catch-up that ignores `waitMs` is still cut at 20 seconds in total | FR-DRAFTS-03-2 | UC |
| FR-DRAFTS-03-8 a session killed after the provider call: at restart the draft is "unknown" and `ResolveUnknownSends` links it | FR-DRAFTS-03-8, FR-DRAFTS-03-13 | X |
| FR-DRAFTS-03-1 an order draft runs the same check before `RecordOrder` | FR-DRAFTS-03-1 | UC |
| FR-DRAFTS-03-7 a `429` with `retryAt` 40 seconds ahead: the draft stays "sending" with `retry_at`, the owner sees `send_queued`, and at that time (fake clock) the checks run and the message is sent once with a new send id | FR-DRAFTS-03-7 | UC |
| FR-DRAFTS-03-7 a `429` in chat A queued for 40 seconds: a send in chat B goes out at once | FR-DRAFTS-03-7 | UC |
| FR-DRAFTS-03-7 at the retry time the customer has written again, or an owner reply from the app exists, or an unlinked owner reply exists: the send is held, the approval is void, a `SendNeedsOwner` signal is published, and nothing is sent | FR-DRAFTS-03-4, FR-DRAFTS-03-7 | UC |
| FR-DRAFTS-03-7 a `429` whose `retryAt` is after the customer's last message plus 24 hours: "failed" with `fail_window_closed` at once, no timer, owner told | FR-DRAFTS-03-7 | UC |
| FR-DRAFTS-03-7 a second `429` at the retry queues again; the window check runs each time | FR-DRAFTS-03-7 | UC |
| FR-DRAFTS-03-7 the process stops while a send is queued: at start the draft is re-scheduled at `max(retry_at, now)` and runs every check; a "sending" draft with no `retry_at` becomes "unknown" | FR-DRAFTS-03-7, FR-DRAFTS-03-8 | X |
| FR-DRAFTS-03-8 a draft left "recording" at a crash, and `RecordOrder` answers `outcome_unknown` at restart: the draft becomes "unknown", `RedriveRecording` counts it in `unknown`, and a second restart does not call `RecordOrder` again | FR-DRAFTS-03-8 | X |

Every FR id of FRD-03 (03-1 to 03-13) appears above.

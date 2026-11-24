# Kapso research

Researched 2026-11-17 from public docs only. Pages were read through a summarizing fetcher, so quotes are the fetcher's rendering of the page and should be re-checked against the page before they are relied on.

## Q1. Free plan and Coexistence

Coexistence is set up in Kapso under Connected numbers, Connect new number, WhatsApp Business App. The docs name no plan requirement for it ("Not documented"), so nothing says the Free plan excludes it. Free plan limits: 2,000 messages per month (inbound and outbound), 1 connected number, 1 GB media. No trial or included credits are mentioned ("Not documented"). Payment: if Meta cannot bill the WABA, outbound template messages are blocked. The page does not name a "Payment issue" status, and it says nothing about non-template (in-window) sends. Coexistence is "less stable than a dedicated Cloud API connection" (disconnects, some first inbound messages not arriving at once, no calling through Kapso).

Source: https://docs.kapso.ai/docs/whatsapp/pricing-faq.md
Quote: "The Free plan includes 1 WhatsApp number."

Source: https://docs.kapso.ai/docs/how-to/whatsapp/coexistence-troubleshooting.md
Quote: "less stable than a dedicated Cloud API connection"

Source: https://docs.kapso.ai/docs/whatsapp/payment-method-troubleshooting.md
Quote: "blocks outbound template messages until the payment and business setup is complete"

Source: https://docs.kapso.ai/docs/how-to/whatsapp/connect-whatsapp.md
Quote: "You cannot change this decision later." (history-sharing choice at signup)

## Q2. Owner echoes

Kapso docs do not say which event carries an echo ("Not documented"). What they do give: echoes are marked in the message object by `message.kapso.origin = "business_app"` (API-sent messages are `cloud_api`, history import is `history_sync`), and `kapso.source = "smb_message_echo"` appears in the extensions page. The likely carrier is `whatsapp.message.sent` (its sample shows `origin: "cloud_api"`), but that is an inference, not documented. No Kapso sample payload for a `business_app` echo exists on the pages read. Event list: `whatsapp.message.received|sent|delivered|read|failed`, `whatsapp.conversation.created|ended|inactive`, `whatsapp.thread.ownership_changed|standby`, and two contact events. The `standby` events are for shared numbers handled by another app, not documented as the Coexistence echo path.

Upstream, Meta delivers echoes as webhook field `smb_message_echoes`. Condensed Meta sample (the `message_echoes` array carries `from`, `to`, `id`, `timestamp`, `type`, `text`):

```json
{"object":"whatsapp_business_account","entry":[{"id":"102290129340398","changes":[{"field":"smb_message_echoes","value":{"messaging_product":"whatsapp","metadata":{"display_phone_number":"15550783881","phone_number_id":"106540352242922"},"message_echoes":[{"from":"15550783881","to":"16505551234","id":"wamid.HBgL...","timestamp":"1700255121","type":"text","text":{"body":"<MESSAGE_TEXT>"}}]}}]}]}
```

Open item: confirm the Kapso event and a real payload by sending one echo through a sandbox or test number.

Source: https://docs.kapso.ai/docs/platform/webhooks/message-events.md
Quote: `message.kapso.origin` value `business_app`: "Echoed from the WhatsApp Business App" (table row, paraphrased by fetcher)

Source: https://docs.kapso.ai/docs/whatsapp/typescript-sdk/kapso-extensions.md
Quote: "SMB echoes are tagged with `kapso.source = \"smb_message_echo\"`."

Source: https://developers.facebook.com/docs/whatsapp/embedded-signup/custom-flows/onboarding-business-app-users
Quote: "it triggers an smb_message_echoes webhook"

## Q3. Fetching messages missed while offline

Yes. Both endpoints use header `X-API-Key: <key>` and base `https://api.kapso.ai`.

- `GET /platform/v1/whatsapp/conversations`: filters `last_active_after`, `last_active_before`, `created_after`, `created_before` (date-time), `phone_number_id`, `status`, `limit` (1-100, default 20). Newest activity first.
- `GET /platform/v1/whatsapp/messages`: filters `conversation_id`, `phone_number_id`, `direction`, `status`, `message_type`, `limit` (1-100, default 20). No time filter. Newest first.
- Pagination: cursors `after` / `before` (Base64). Response has `data` and `paging.cursors.{before,after}`, `paging.next`, `paging.previous`.

Catch-up recipe: list conversations with `last_active_after=<last seen>`, then list messages per `conversation_id` until a known message. Retention: "kept indefinitely" by default; paid projects can shorten it. Webhook deliveries can also be listed (`GET .../webhook-deliveries`, page not opened, not relied on).

Source: https://docs.kapso.ai/api/platform/v1/conversations/list-conversations.md
Quote: `last_active_after`: "Conversations active after this timestamp."

Source: https://docs.kapso.ai/api/platform/v1/messages/list-messages.md
Quote: "returned newest first" (no date or time parameters in the spec)

Source: https://docs.kapso.ai/docs/platform/whatsapp-data.md
Quote: "Everything above is kept indefinitely."

## Q4. Webhook delivery

- Retries: immediate attempt, then retry 10 s and 40 s after failures. `max_attempts` default 3, counting the first delivery. About 50 s total. Then marked failed.
- Timeout: respond 200 within 10 s. Ordering uses a separate 30 s wait, so out-of-order delivery is possible.
- Idempotency: header `X-Idempotency-Key`; store keys and skip repeats. Return 500 to force a retry.
- Other headers: `X-Webhook-Event`, `X-Webhook-Batch` (`true` for batched payloads), `X-Webhook-Signature`.
- Signature: HMAC-SHA256 of the raw body with the webhook secret, hex digest in `X-Webhook-Signature`.
- Secret: per webhook. For WhatsApp webhooks you supply `secret_key`; Kapso does not generate it. Project webhooks are separate (project-wide events only, no message events); WhatsApp webhooks are per phone number.
- Auto-pause: 40+ deliveries, 10+ failures, 85%+ failure rate within 15 min sets `active: false`.

Source: https://docs.kapso.ai/docs/platform/webhooks/advanced.md
Quote: "Return 200 within 10 seconds."

Source: https://docs.kapso.ai/docs/platform/webhooks/security.md
Quote: "Kapso signs all webhooks with HMAC SHA256 using your webhook secret key."

Source: https://docs.kapso.ai/docs/platform/webhooks/overview.md
Quote: "Copy the auto-generated secret key." (project webhooks; fetcher also reports WhatsApp webhooks take a caller-supplied `secret_key`)

Source: https://docs.kapso.ai/api/platform/v1/webhooks/create-webhook.md
Quote: "never generated for you"

## Live check, 2026-11-17: owner echo through the API

The owner sent one message from the WhatsApp Business app on the Coexistence number. Listing outbound messages for that number (`GET /platform/v1/whatsapp/messages?phone_number_id=…&direction=outbound`) returned it as the newest entry with `kapso.origin = "business_app"`, `kapso.direction = "outbound"`, `kapso.status = "delivered"`. Older entries from the history import carry `origin = "history_sync"`. The platform API object has no `kapso.source` field (`smb_message_echo` is set only by Kapso's SDK normalizer). So catch-up alone can tell owner echoes apart; which webhook event carries them is still unchecked.

## Rate limits, 2026-11-17

Kapso limits API requests per API key per fixed minute: Free 100, Pro 2,000, Platform and Enterprise 4,000. Over the limit it returns `429` with `Retry-After`; every response carries `X-RateLimit-Limit` and `X-RateLimit-Remaining`. A live call on the owner's key returned `x-ratelimit-limit: 100`, `x-ratelimit-remaining: 99`.

Effect on periodic catch-up: one check costs one conversation listing plus one message listing per conversation with new activity, so a check every 2 minutes uses a few requests per minute at most. A first catch-up after a long absence with many active conversations can need more: page through results and slow down when `X-RateLimit-Remaining` gets low. The monthly quota of the free plan counts messages, not API requests.

Source: https://docs.kapso.ai/api/rate-limits
Quote: "Read `X-RateLimit-Remaining` and back off before you hit zero"

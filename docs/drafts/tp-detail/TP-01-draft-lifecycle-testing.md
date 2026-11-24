# TP-01-draft-lifecycle: Testing

Part of [TP-01-draft-lifecycle.md](../tp/TP-01-draft-lifecycle.md). Moved verbatim from there; nothing changed.

## Testing

ATDD (cross-cutting TD-11): each test below is written first from the FRD line, titled with its FR id. Layer UC means a use case run through its inbound port with in-memory adapters and a fake clock; D means a domain unit test; C means an adapter contract test run on the in-memory and SQLite adapters; E means end to end over stdio.

| Test | FR ids | Layer |
|---|---|---|
| FR-DRAFTS-01-1 create_draft stores chat, text, time and the latest message time, and gives a number | FR-DRAFTS-01-1 | UC |
| FR-DRAFTS-01-1 a reply and an order draft get different numbers from one counter | FR-DRAFTS-01-1 | UC |
| FR-DRAFTS-01-1 a new draft after a closed one never gets an earlier number | FR-DRAFTS-01-1 | UC, C |
| FR-DRAFTS-01-2 a new draft is waiting and the fake provider received nothing | FR-DRAFTS-01-2 | UC |
| FR-DRAFTS-01-3 list_drafts shows number, chat, exact text and the customer message answered | FR-DRAFTS-01-3 | UC, E |
| FR-DRAFTS-01-3 list_drafts with no drafts says so | FR-DRAFTS-01-3 | UC |
| FR-DRAFTS-01-3 a draft whose text and answered message contain `</customer_text>` and `&` is listed with `&lt;/customer_text&gt;` and `&amp;`, inside one label, through the shared escape helper | FR-DRAFTS-01-3 | UC |
| FR-KNOWLEDGE-01-14 through the `list_drafts` MCP adapter, with a fake Knowledge: a reply draft made at T and a catalog saved after T: `CatalogChangedSince` answers changed and the list shows the mark; saved before T gives no mark; `'unknown'` shows `catalog_check_unavailable`; an order draft with a changed snapshotted price shows the mark even when the time check says unchanged; `ListDrafts` itself imports and calls nothing of Knowledge (architecture test) | FR-KNOWLEDGE-01-14 | E, ARCH |
| FR-DRAFTS-01-4 WaitingChats returns waiting, held, failed and unknown drafts with chat, time and state, and no text | FR-DRAFTS-01-4 | UC |
| FR-DRAFTS-01-4 a draft made before the session started (fake clock) is listed with `fromEarlierSession` true and `WaitingChats` returns `earlierSession` true; a draft made after is false; the send path checks the chat the same way (D25) | FR-DRAFTS-01-4 | UC |
| FR-DRAFTS-01-4 two chats with waiting drafts return exactly those two with their written times | FR-DRAFTS-01-4 | UC |
| FR-DRAFTS-01-5 changing the text of an approved draft returns it to waiting and voids the approval | FR-DRAFTS-01-5 | D (approved is transient), UC (held draft) |
| FR-DRAFTS-01-6 a rejected draft is closed and a later approval is refused | FR-DRAFTS-01-6 | UC |
| FR-DRAFTS-01-7 a new reply draft replaces the waiting one, logs it, and the answer says so | FR-DRAFTS-01-7 | UC |
| FR-DRAFTS-01-7 replacing an approved draft closes it as replaced and voids its approval | FR-DRAFTS-01-7 | D |
| FR-DRAFTS-01-7 a reply draft never replaces an order draft and the other way round | FR-DRAFTS-01-7 | UC |
| FR-DRAFTS-01-7 a draft in "sending" cannot be replaced; the second unique open draft is rejected by the database | FR-DRAFTS-01-7 | UC, C |
| FR-DRAFTS-01-8 a chat with only dev messages is refused once the provider is not dev | FR-DRAFTS-01-8 | UC |
| FR-DRAFTS-01-1 an unknown chat, a chat with no customer message and an empty text are refused | FR-DRAFTS-01-1 | UC |
| FR-DRAFTS-01-3 the whole draft flow over MCP: create, list, change, reject | FR-DRAFTS-01-1, FR-DRAFTS-01-3, FR-DRAFTS-01-5, FR-DRAFTS-01-6 | E |

Every FR id of FRD-01 (01-1 to 01-8) appears above.

# SPEC-01-1: The notice value and its default text

Status: Draft
Rests on: ../frd/FRD-01-batched-notice.md

## Summary

The `Notice` value for a batch of new messages, its fixed English text and the envelope Deputy writes to the session. A notice holds counts and closed codes only, so no customer text, name or chat id can reach it. Nothing uses it yet.

Last change: 2026-11-24, first draft for the local pilot

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-NOTIFY-01-3 | always | A notice states three counts: new messages, the chats they come from, and other chats still waiting for an answer. It does not count orders. It is a short line or two. (R-NOTIFY-3) |
| FR-NOTIFY-01-5 | always | A notice contains counts only: no customer text, no excerpt, no customer name, and no wording that could be read as an instruction. The words of the notice are fixed by Deputy and only the numbers vary. This holds for the whole notice, text and every attribute it carries: no chat identifier, phone number, name, tag or sender. (R-NOTIFY-4) |
| FR-NOTIFY-01-6 | always | A notice points the owner to the inbox, for example "Ask what is pending." It is not the record of what is pending. (R-NOTIFY-5) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/notify/domain/notice.ts` | Create | `Notice`, `defaultText`, `toEnvelope` |
| `test/notify/unit/notice.test.ts` | Create | the tests below |

## Reuses
- Nothing to reuse: Notify has no code yet; the type and text table follow docs/notify/tp-detail/TP-01-batched-notice-interfaces.md

## Tests first
FR-NOTIFY-01-3, FR-NOTIFY-01-5, FR-NOTIFY-01-6, written before the code, without it in view. FR-NOTIFY-01-3: a notice of 3 messages, 2 chats and 5 other waiting has the text `3 new messages from 2 chats. 5 other chats are still waiting. Ask what is pending.`; 1 message and 1 chat gives `1 new message from 1 chat.` and the pointer; with 0 other waiting the second sentence is left out; the caveat `waiting_may_be_incomplete` adds ` The waiting count may be incomplete.` before the pointer. FR-NOTIFY-01-6: every text ends with `Ask what is pending.`. FR-NOTIFY-01-5: for 200 random chat ids, names and numbers the JSON of the envelope holds none of them; `meta` keys are letters, digits and underscores and its values are the code, numbers and caveat codes only.

## Build
```ts
export type Caveat = "waiting_may_be_incomplete";
export type Notice = { code: "new_messages"; messages: number; chats: number; otherWaiting: number; caveats: Caveat[] };
export interface NoticeEnvelope { text: string; meta: Record<string, number | string> }
export function defaultText(n: Notice): string;
export function toEnvelope(n: Notice): NoticeEnvelope; // meta: code, messages, chats, otherWaiting, caveats as a comma list
```
`Notice` has no free string field, so the notice can hold no customer data by type.

## Done when
`bun test test/notify/unit/notice.test.ts`

## Out of scope
The reminder, outage and send-needs-owner codes (deferred, FR-NOTIFY-01-14). The channel write (SPEC-01-5).

## Open questions
None.

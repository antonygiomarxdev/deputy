# SPEC-01-5: The Claude channel writes the notice

Status: Draft
Rests on: ../frd/FRD-01-batched-notice.md

## Summary

The `Notifier` adapter: it reports `ready` whenever the server offers the channel, and writes a notice as one `notifications/claude/channel` message with the text and the meta. The server now declares the capability. It cannot see whether the client registered a listener, and an unregistered channel ignores the notice; that is accepted and unverified until the live test.

Last change: 2026-11-24, first draft for the local pilot

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-NOTIFY-01-5 | always | A notice contains counts only: no customer text, no excerpt, no customer name, and no wording that could be read as an instruction. The words of the notice are fixed by Deputy and only the numbers vary. This holds for the whole notice, text and every attribute it carries: no chat identifier, phone number, name, tag or sender. (R-NOTIFY-4) |
| FR-NOTIFY-01-15 | WHEN | When a notice cannot be delivered, because no session is open or writing returns an error, Deputy keeps the batch and tries again after 60 seconds, and the next notice counts those messages as new. With no open session nothing is sent and the inbox keeps listing the messages. (FR-NOTIFY-03-4, FR-NOTIFY-03-6, FR-NOTIFY-03-7, ADR-006) |
| FR-NOTIFY-01-16 | always | A notice sends nothing to a customer and approves nothing: receiving it cannot cause a send or an approval. (FR-NOTIFY-03-3) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/notify/adapters/channel/claude-channel-notifier.ts` | Create | `ClaudeChannelNotifier` |
| `src/main/tools.ts` | Change | `claudeChannel: true` |
| `test/notify/unit/claude-channel-notifier.test.ts` | Create | the tests below |

## Reuses
- `src/composition/mcp/server.ts` `createMcpServer`: the `claudeChannel` flag that adds the capability
- Precedent: SPEC-01-3-tick.md, the `Notifier` port this adapter implements

## Tests first
FR-NOTIFY-01-5, FR-NOTIFY-01-15, FR-NOTIFY-01-16, written before the code, without it in view, with a fake server. FR-NOTIFY-01-15: `availability()` is `ready` when the channel is enabled and `off` when it is not; `deliver` returns `failed no_session` when the transport is closed and `failed write_error` when the notification rejects, and `delivered` otherwise. FR-NOTIFY-01-5: `deliver` sends one `notifications/claude/channel` whose `content` is the envelope text and whose `meta` is the envelope meta, and nothing else. FR-NOTIFY-01-16: the adapter holds no send port and no approval; its only output is that notification. The created server declares the capability.

## Build
```ts
export class ClaudeChannelNotifier implements Notifier {
  constructor(d: { enabled: boolean; server: { notification(n: { method: string; params: { content: string; meta: Record<string, number | string> } }): Promise<void> }; isClosed(): boolean })
}
```
`tools.ts` passes `claudeChannel: true`, and `src/main/notify.ts` (SPEC-01-7) passes `enabled: true`, a constant for the pilot (FR-NOTIFY-01-14); the `off` case is tested with `enabled: false`. The notice reaches the session only when the owner launched Claude Code with the channel flag of ADR-018; otherwise the client ignores it.

## Done when
`bun test test/notify/unit/claude-channel-notifier.test.ts`

## Out of scope
The launch shortcut and the flag (Setup). Whether an idle session wakes at once on a notice, and that an unregistered channel is ignored without harm, are unverified (ADR-018).

## Open questions
None.

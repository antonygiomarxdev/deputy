# SPEC-04-5: The five knowledge tools

Status: Draft
Rests on: ../tp/TP-04-pilot-knowledge-files.md

## Summary

The tools the agent calls: read_knowledge, save_profile, save_catalog, save_always_ask and remember, with no path or URL input, labeled results and the known limit stated in their descriptions. Fifth of six runs for FRD-04.

Last change: 2026-11-24, first draft for REQ-15 and D38.

One spec is one agent run: at most 80 lines, 3 files and one done command. Too big: split it into another spec, never add context. A spec decides nothing new.

## Rows
Quoted from: ../frd/FRD-04-pilot-knowledge-files.md

| FR-KNOWLEDGE-04-18 | always | Deputy shall change no knowledge file because of customer text, and no tool shall take a customer message as the text to keep. |
| FR-KNOWLEDGE-04-19 | always | Deputy shall read no spreadsheet or document of the owner and shall hold no credentials of any other service; the session reads what the owner gives and saves the result with `save_catalog`. |
| FR-KNOWLEDGE-04-20 | always | Deputy shall check only that the owner's words were supplied in the session and, in the control chat, that the sender is an owner number; it cannot check who spoke in the session (known limit, D11). |
| INV-3 | No tool input names a file path (FR-KNOWLEDGE-04-1). |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/knowledge/adapters/mcp/knowledge-tools.ts` | Create | The five tool definitions |
| `src/knowledge/index.ts` | Create | The only file other slices may import |

## Reuses
- `src/adapters/mcp/tool.ts` `defineTool`: tool definition and input validation
- `src/adapters/mcp/customer-text.ts` `customerText`: labels text that came from outside
- `src/drafts/adapters/mcp/log-tools.ts` `logTools`: the style of a tool list returned as an array

## Tests first
FR-KNOWLEDGE-04-18, FR-KNOWLEDGE-04-19, FR-KNOWLEDGE-04-20, INV-3, in `test/knowledge/adapters`, written without the code in view: the five input shapes hold no path, no URL and no customer message field, and the descriptions of the saving tools state the known limit.

## Build
```ts
export function knowledgeTools(u: { read: ReadKnowledge; save: SaveKnowledgeFile; remember: Remember }): ToolDefinition[];
// input: save_*: { text, owner_words }; remember: { text, source: { kind: "session", owner_words } | { kind: "control_chat", message_id } }
```
A refusal is `isError: true` with the code as the text. `src/knowledge/index.ts` exports `knowledgeTools`, `createFileKnowledgeStore`, `ReadKnowledge`, `SaveKnowledgeFile`, `Remember` and the port types.

## Done when
`bun test test/knowledge`

## Out of scope
Building the objects and adding the tools to the server (SPEC-04-6).

## Open questions
None.

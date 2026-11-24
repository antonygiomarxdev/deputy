# SPEC-04-5: The six knowledge tools and the always-ask export

Status: Draft
Rests on: ../tp/TP-04-pilot-knowledge-files.md

## Summary

The tools the agent calls: read_knowledge, save_profile, save_catalog, save_always_ask, save_memory and remember, with no path or URL input, labeled results and the known limit stated in their descriptions. Fifth of seven runs for FRD-04.

Last change: 2026-11-24, the index also exports readAlwaysAsk for other slices, with its row and examples.

One spec is one agent run: at most 80 lines, 3 files and one done command. Too big: split it into another spec, never add context. A spec decides nothing new.

## Rows
Quoted from: ../frd/FRD-04-pilot-knowledge-files.md

| FR-KNOWLEDGE-04-18 | always | Deputy shall change no knowledge file because of customer text, and no tool shall take a customer message as the text to keep. |
| FR-KNOWLEDGE-04-19 | always | Deputy shall read no spreadsheet or document of the owner and shall hold no credentials of any other service; the session reads what the owner gives and saves the result with `save_catalog`. |
| FR-KNOWLEDGE-04-20 | always | Deputy shall check only that the owner's words were supplied in the session and, in the control chat, that the sender is an owner number; it cannot check who spoke in the session (known limit, D11). |
| FR-KNOWLEDGE-04-24 | WHEN | WHEN another slice asks for the always-ask classes, Deputy shall return the entries of always-ask.md as a list, one entry for each non-blank line with its surrounding spaces and a leading list marker removed, and an empty list when the file is missing or holds no entry. |
| EX-28 | RULE-6 | positive | always-ask.md holds the lines "- Delivery price that depends on the address" and "Anything about refunds" and a blank line | another slice asks for the always-ask classes | the list holds "Delivery price that depends on the address" and "Anything about refunds" |
| EX-29 | RULE-6 | negative | always-ask.md does not exist | another slice asks for the always-ask classes | the list is empty and no file is created |
| INV-3 | No tool input names a file path (FR-KNOWLEDGE-04-1). |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/knowledge/adapters/mcp/knowledge-tools.ts` | Create | The six tool definitions |
| `src/knowledge/index.ts` | Create | The only file other slices may import; exports `readAlwaysAsk` |
| `src/knowledge/application/read-always-ask.ts` | Create | The ReadAlwaysAsk use case |

## Reuses
- `src/adapters/mcp/tool.ts` `defineTool`: tool definition and input validation
- `src/adapters/mcp/customer-text.ts` `customerText`: labels text that came from outside
- `src/drafts/adapters/mcp/log-tools.ts` `logTools`: the style of a tool list returned as an array

## Tests first
FR-KNOWLEDGE-04-18, FR-KNOWLEDGE-04-19, FR-KNOWLEDGE-04-20, FR-KNOWLEDGE-04-24, EX-28, EX-29, INV-3, in `test/knowledge/adapters` and `test/knowledge/application`, written without the code in view: the six input shapes hold no path, no URL and no customer message field, and the descriptions of the saving tools state the known limit. The index clause is proved by `test/architecture/architecture.test.ts`: it stays green with the new slice, other slices import `src/knowledge` only through `src/knowledge/index.ts`, and a new case in that file shows that an import of the Knowledge read use case from the Drafts slice fails.

## Build
```ts
export function knowledgeTools(u: { read: ReadKnowledge; save: SaveKnowledgeFile; remember: Remember }): ToolDefinition[];
// input: save_*: { text, owner_words }; remember: { text, source: { kind: "session", owner_words } | { kind: "control_chat", message_id } }
```
```ts
export type ReadAlwaysAsk = () => Promise<string[]>;
export function createReadAlwaysAsk(store: KnowledgeStore): ReadAlwaysAsk; // one entry per non-blank line, trimmed, leading "- " or "* " removed; empty when the file is missing; creates nothing
```
A refusal is `isError: true` with the code as the text. `src/knowledge/index.ts` exports `knowledgeTools`, `createFileKnowledgeStore`, `ReadKnowledge`, `SaveKnowledgeFile`, `Remember`, `createReadAlwaysAsk`, `ReadAlwaysAsk` and the port types. Drafts' `send_answer` receives the function from the composition root (`src/main/drafts.ts`), never by importing Knowledge's inside.

## Done when
`bun test test/knowledge`

## Out of scope
Building the objects, registering the tools and the start order (SPEC-04-6 and SPEC-04-9).

## Open questions
None.

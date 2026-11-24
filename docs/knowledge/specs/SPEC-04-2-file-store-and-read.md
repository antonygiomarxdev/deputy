# SPEC-04-2: The file store and read_knowledge

Status: Draft
Rests on: ../tp/TP-04-pilot-knowledge-files.md

## Summary

The four files in the knowledge folder, read with their saved times, written whole through a temporary file with 20 previous versions, and the use case behind read_knowledge. Second of six runs for FRD-04.

Last change: 2026-11-24, first draft for REQ-15 and D38.

One spec is one agent run: at most 80 lines, 3 files and one done command. Too big: split it into another spec, never add context. A spec decides nothing new.

## Rows
Quoted from: ../frd/FRD-04-pilot-knowledge-files.md

| FR-KNOWLEDGE-04-1 | always | Deputy shall keep the owner's knowledge in four plain text files, profile.md, catalog.md, memory.md and always-ask.md, in the folder `knowledge` of the configuration folder, and shall take no file path from any tool input. |
| FR-KNOWLEDGE-04-2 | WHEN | WHEN the agent calls `read_knowledge`, Deputy shall return the always-ask list first and then the profile, the catalog and the memory, each with the time it was last saved and each labeled as the owner's knowledge. |
| FR-KNOWLEDGE-04-3 | IF | IF a knowledge file does not exist, THEN `read_knowledge` shall report it as "not written yet" and shall create nothing. |
| FR-KNOWLEDGE-04-5 | IF | IF the always-ask list is missing or holds no class, THEN `read_knowledge` shall say that no classes were agreed yet, so the agent knows that setup is not finished. |
| FR-KNOWLEDGE-04-11 | always | Deputy shall write a knowledge file so that it holds the old text or the new text and never a part of each, and shall keep the last 20 previous versions of each file. |
| EX-1 | RULE-1 | positive | catalog.md lists "Tamales (dozen) / dozen / 12 / available" | the agent calls `read_knowledge` | the result shows that row unchanged, with the time catalog.md was last saved |
| EX-3 | RULE-1 | negative | memory.md does not exist | the agent calls `read_knowledge` | the result says memory.md is "not written yet" and no file is created |
| EX-11 | RULE-4 | boundary | a save fails after the new text was prepared but before the file was replaced | the agent calls `read_knowledge` | the file still holds the old text in full |
| EX-17 | RULE-6 | positive | always-ask.md lists two classes | the agent calls `read_knowledge` | the always-ask list comes first and shows both classes |
| EX-18 | RULE-6 | negative | always-ask.md does not exist | the agent calls `read_knowledge` | the result says no classes were agreed yet |
| EX-19 | RULE-4 | positive | this is the owner process and profile.md holds the text A | the agent saves the text B with the owner's words | profile.md holds the whole text B and one previous version holds the whole text A |
| EX-20 | RULE-4 | boundary | profile.md has 20 previous versions | the agent saves a new profile with the owner's words | 20 previous versions remain and the oldest one is gone |
| INV-2 | A knowledge file holds the whole old text or the whole new text, never a part of each (FR-KNOWLEDGE-04-11). |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/knowledge/ports/knowledge-store.ts` | Create | The KnowledgeStore port |
| `src/knowledge/adapters/files/file-knowledge-store.ts` | Create | The file adapter |
| `src/knowledge/application/read-knowledge.ts` | Create | The ReadKnowledge use case |

## Reuses
- `src/adapters/config/config-file.ts` `readConfigFile`: the same reading style and the same configuration folder
- Precedent: SPEC-04-1-catalog-table-and-limits.md, whose `renderCatalog` shows the empty price as to be confirmed

## Tests first
FR-KNOWLEDGE-04-1, FR-KNOWLEDGE-04-2, FR-KNOWLEDGE-04-3, FR-KNOWLEDGE-04-5, FR-KNOWLEDGE-04-11, EX-1, EX-3, EX-11, EX-17, EX-18, EX-19, EX-20, INV-2, in `test/knowledge/files`, written without the code in view; one contract test runs the same cases on the file store and on an in-memory store.

## Build
```ts
export type KnowledgeFileName = "profile" | "catalog" | "memory" | "always-ask";
export interface KnowledgeStore {
  read(name: KnowledgeFileName): Promise<{ text: string; savedAt: number } | null>;
  write(name: KnowledgeFileName, text: string, at: number): Promise<void>; // temp file, copy old to history, rename, keep 20
  append(name: "memory", line: string, at: number): Promise<void>;
}
export function createFileKnowledgeStore(dir: string): KnowledgeStore; // dir = <configDir>/knowledge
export class ReadKnowledge {
  constructor(store: KnowledgeStore);
  read(): Promise<{ files: { name: KnowledgeFileName; text: string | null; savedAt: number | null }[]; alwaysAskAgreed: boolean }>;
}
```
The result lists always-ask first, then profile, catalog and memory. Reads are never cached.

## Done when
`bun test test/knowledge`

## Out of scope
The save use cases (SPEC-04-3), the memory rules (SPEC-04-4) and the tools (SPEC-04-5).

## Open questions
None.

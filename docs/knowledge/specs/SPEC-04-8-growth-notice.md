# SPEC-04-8: Tell the session when knowledge has grown too long

Status: Draft
Rests on: ../tp/TP-04-pilot-knowledge-files.md

## Summary

When the memory or the catalog is longer than one turn can carry, `read_knowledge` adds the notice `knowledge_long` with the sizes, and the tool text tells the session to tell the owner and propose a summary for the owner to approve. Deputy deletes and shortens nothing by itself. Eighth run for FRD-04.

Last change: 2026-11-24, first draft for FR-KNOWLEDGE-04-23.

One spec is one agent run: at most 80 lines, 3 files and one done command. Too big: split it into another spec, never add context. A spec decides nothing new.

## Rows
Quoted from: ../frd/FRD-04-pilot-knowledge-files.md

| FR-KNOWLEDGE-04-23 | WHEN | WHEN the memory or the catalog has grown past what fits in each turn, the session shall tell the owner and propose a summary for the owner to approve, and Deputy shall not delete anything on its own. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/knowledge/domain/limits.ts` | Create | built by SPEC-04-1, this run adds `LIMITS.turnChars` and `growthNotice` |
| `src/knowledge/application/read-knowledge.ts` | Create | built by SPEC-04-2, this run adds `notices` to the result |
| `src/knowledge/adapters/mcp/knowledge-tools.ts` | Create | built by SPEC-04-5, this run adds the text the session reads next to the notice |

## Reuses
- Precedent: SPEC-04-1-catalog-table-and-limits.md, which defines `LIMITS` and `textSize`
- Precedent: SPEC-04-2-file-store-and-read.md, which defines `ReadKnowledge` and the size of each file
- Precedent: SPEC-04-5-knowledge-tools.md, which defines the tool texts

## Tests first
FR-KNOWLEDGE-04-23, written without the code in view, in `test/knowledge/domain`, `test/knowledge/application` and `test/knowledge/adapters`. Cases: the sizes of the memory and the catalog together at the limit give no notice, one character over give `knowledge_long`; the result lists the size of each file; a read changes and deletes nothing (the store is unchanged after it); the tool text names the notice, tells the session to tell the owner and propose a summary, and says that only the owner's approval saves it; the profile and the always-ask list do not count.

## Build
```ts
export const LIMITS: { /* as SPEC-04-1 */ turnChars: number }; // value: see Open questions Q-1
export function growthNotice(sizes: { memory: number | null; catalog: number | null }): "knowledge_long" | null; // null at or under turnChars
// ReadKnowledge.read() result gains: notices: ("catalog_unreadable" | "knowledge_long")[]
```
The notice carries no text of the files, only the sizes. The session proposes the summary and the owner approves it in the conversation; saving it is the owner's go through a save tool (Open questions Q-2).

## Done when
`bun test test/knowledge`

## Out of scope
Writing or shortening the memory or the catalog (SPEC-04-3 saves a catalog; the memory write is Q-2), and any automatic deletion.

## Open questions
- Q-1 (Owner: only the owner can say how much of the plan one turn may spend on knowledge): what total size of the memory and the catalog counts as "past what fits in each turn"? A starting value of 12000 characters is proposed, from the approved limits (500 catalog items, 500 characters per memory entry); it is not decided.
- Q-2 (Lead): FR-KNOWLEDGE-04-23 asks the owner to approve a summary of the memory, but the memory has no tool that replaces it (`remember` only appends, SPEC-04-4). Name one: add `memory` to the whole-file saves of SPEC-04-3 with the owner's words, or another way.

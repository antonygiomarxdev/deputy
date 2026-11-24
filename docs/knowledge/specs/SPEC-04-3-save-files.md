# SPEC-04-3: Save the profile, the catalog and the always-ask list

Status: Draft
Rests on: ../tp/TP-04-pilot-knowledge-files.md

## Summary

The use case that replaces a whole file after the owner's words: owner process, words size, catalog table check, previous version kept, change recorded. Third of seven runs for FRD-04.

Last change: 2026-11-24, first draft for REQ-15 and D38.

One spec is one agent run: at most 80 lines, 3 files and one done command. Too big: split it into another spec, never add context. A spec decides nothing new.

## Rows
Quoted from: ../frd/FRD-04-pilot-knowledge-files.md

| FR-KNOWLEDGE-04-6 | WHEN | WHEN the agent calls `save_profile`, `save_catalog` or `save_always_ask` with the whole new text and the owner's words, Deputy shall keep the previous version, replace the file, record the change with the owner's words, and return a short summary (for the catalog: items added, removed and changed). |
| FR-KNOWLEDGE-04-7 | IF | IF the owner's words are empty or longer than 1000 characters, THEN Deputy shall refuse the save and change nothing. |
| FR-KNOWLEDGE-04-8 | IF | IF this process is not the owner process, THEN Deputy shall refuse a save or a remember with `not_owner` and change nothing. |
| EX-4 | RULE-2 | positive | this is the owner process and profile.md holds "We sell tamales" | the agent calls `save_profile` with a new text and the words "Yes, that is right" | profile.md holds the new text, the old text is kept as a previous version, and the change is recorded with those words |
| EX-5 | RULE-2 | negative | this is the owner process | the agent calls `save_profile` with the words "" | Deputy refuses and profile.md is unchanged |
| EX-6 | RULE-2 | negative | this process is read-only | the agent calls `save_catalog` with a valid text and words | Deputy refuses with `not_owner` and catalog.md is unchanged |
| EX-7 | RULE-2 | boundary | this is the owner process | the agent saves with words of 1000 characters, then with words of 1001 characters | the first save is accepted and the second is refused |
| ST-1 | Absent | first accepted save | Present, with no previous version |
| ST-2 | Present | accepted save | Present, the old text kept as a previous version |
| ST-3 | Absent or Present | refused save | unchanged, and no previous version is created |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/knowledge/application/save-knowledge-file.ts` | Create | The SaveKnowledgeFile use case |
| `src/knowledge/ports/change-log.ts` | Create | The ChangeLog port |
| `src/knowledge/adapters/files/file-change-log.ts` | Create | Appends a line to the change record |

## Reuses
- `src/shared/owner-words.ts` `parseOwnerWords`: the 1 to 1000 characters rule
- `src/shared/owner-lease.ts` `OwnerLease`: refuse unless this is the owner process

## Tests first
FR-KNOWLEDGE-04-6, FR-KNOWLEDGE-04-7, FR-KNOWLEDGE-04-8, EX-4, EX-5, EX-6, EX-7, ST-1, ST-2, ST-3, in `test/knowledge/application`, written without the code in view.

## Build
```ts
export interface ChangeLog { record(e: { at: number; file: KnowledgeFileName; ownerWords: string; summary: string }): Promise<void>; }
export type SaveResult = { ok: true; summary: string } | { ok: false; code: Refusal };
export class SaveKnowledgeFile {
  constructor(d: { store: KnowledgeStore; log: ChangeLog; lease: OwnerLease; now(): number });
  execute(i: { file: "profile" | "catalog" | "always-ask"; text: string; ownerWords: string }): Promise<SaveResult>;
}
```
Order: lease, words, size (profile and always-ask) or `parseCatalogTable` (catalog), `store.write`, then `log.record`. A failed log write is reported in the summary and does not undo the save.

## Done when
`bun test test/knowledge`

## Out of scope
The memory (SPEC-04-4) and the tools that call this use case (SPEC-04-5).

## Open questions
None.

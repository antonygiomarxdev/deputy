# SPEC-05-18: The transcript reader

Status: Draft
Rests on: ../frd/FRD-05-pilot-setup.md

## Summary

A small adapter that lists the Deputy session's transcript files (the session file and the helper files under it) in the agent's projects folder for this project, reads each, and gives each file its part. A missing folder or file, or an unrecognized format, is reported and gives no numbers for that file.

Last change: 2026-11-24, first draft for the dispatcher session

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-SETUP-05-49 | always | The token counts shall come only from the usage, the model and the time of each transcript entry, and the result shall hold no text, no id and no path. (Proposed, lead decision.) |
| FR-SETUP-05-50 | IF | IF a transcript file is missing or its format is not the expected one, THEN Deputy shall say so and return no numbers for it. (Proposed, lead decision.) |
| EX-24 | RULE-10 | boundary | A transcript file has a format Deputy does not know | The owner asks for the counts | Deputy says the format is not recognized and returns no numbers for that file |

## Files
| Path | Create or change | Holds |
|---|---|---|
| src/setup/adapters/transcripts/transcript-reader.ts | Create | `TranscriptReader` |
| test/setup/unit/transcript-reader.test.ts | Create | the tests below |

## Reuses
- Precedent: SPEC-05-17-token-usage.md, the function the reader feeds
- Precedent: SPEC-05-6-keep-awake.md, an adapter that takes its operating system calls as parameters so a test supplies them

## Tests first
FR-SETUP-05-49, FR-SETUP-05-50, EX-24, written before the code, without it in view, with a fake folder of files. FR-SETUP-05-50: a folder that does not exist gives `{ kind: "missing" }` and no numbers; a file that cannot be read gives that file as missing and the others still count; EX-24: a file `addUsage` calls unrecognized is listed by its part (never by its path) and gives no numbers. FR-SETUP-05-49: the part of a file is `dispatcher` for the session file, and for a helper file the agent name the transcript carries (`triage` or `web`), else `helper`; the result holds no path.

## Build
```ts
export interface TranscriptReader { read(): Promise<{ kind: "files"; files: { part: Part; lines: string[] }[]; missing: number } | { kind: "missing" }> }
export function createTranscriptReader(d: { projectsDir: string; sessionId: () => string | null; listDir(p: string): Promise<string[]>; readText(p: string): Promise<string> }): TranscriptReader;
```

## Done when
`bun test test/setup/unit/transcript-reader.test.ts`

## Out of scope
The adding up (SPEC-05-17); the tool and its registration (SPEC-05-19); the next transcript path of an OpenTelemetry route (later).

## Open questions
None. A helper's part is the agent name its transcript carries, else "helper" (Proposed, lead decision); that the transcript carries the name is on the unverified list of ADR-018.

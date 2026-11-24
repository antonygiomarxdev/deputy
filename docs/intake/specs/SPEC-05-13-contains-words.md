# SPEC-05-13: containsWords, the whole-token match of the owner's words

Status: Draft
Rests on: ../frd/FRD-05-pilot-owner-chat-and-tools.md

## Summary

A pure function `containsWords(message, text)` in the shared text module: both strings go through `normalizeText`, and the text counts as contained when it appears in the message with a token boundary on each side (the start or end of the message, or a character that is not a letter or a digit). Nothing calls it yet; SPEC-05-7 does, and Knowledge `remember` reuses it.

Last change: 2026-11-24, first draft

One spec is one agent run: at most 80 lines, 3 files and one done command. A spec decides nothing new.

## Rows

| FR-INTAKE-05-24 | IF | If the text the session records is not contained in a message the owner sent in the control chat after the question was asked, Intake refuses, changes nothing and publishes nothing, so the go comes only from the owner's own words, as docs/adr/ADR-006-draft-send-path.md and Drafts ADR-003 say. The text is contained when it appears in the message on whole-token boundaries; the message may hold more, because one message can answer several questions. |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/shared/text.ts` | Change | `containsWords` |
| `test/shared/contains-words.test.ts` | Create | the tests below |

## Reuses
- `src/shared/text.ts` `normalizeText`: the comparison form of both strings

## Tests first
FR-INTAKE-05-24, written before the code, without it in view. FR-INTAKE-05-24: `containsWords("Yes, ok for tomorrow", "ok")` is true; `containsWords("look at it", "ok")` is false (inside a longer word); `containsWords("1) yes 2) no", "no")` is true and `containsWords("none", "no")` is false; a message that holds two answers accepts each of them; letter case and accents of the same form (`normalizeText`) do not matter; digits count as part of a token (`containsWords("room 12", "1")` is false); a text that is empty after `normalizeText` is false; the same text as the whole message is true.

## Build
```ts
/** True when normalizeText(text) occurs in normalizeText(message) with a token boundary on each side. */
export function containsWords(message: string, text: string): boolean
```
Find each occurrence of the normalized text in the normalized message; accept it when the character before it and the character after it are absent or are not a letter or a digit (`\p{L}`, `\p{N}`).

## Done when
`bun test test/shared/contains-words.test.ts`

## Out of scope
Using it (SPEC-05-7); stemming, plurals or fuzzy matches.

## Open questions
None.

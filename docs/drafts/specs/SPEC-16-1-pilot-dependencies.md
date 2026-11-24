# SPEC-16-1: Build the pilot dependencies of Drafts in the composition root

Status: Draft
Rests on: ../frd/FRD-02-owners-go.md

## Summary

One builder in the composition root makes what the pilot tools need: the pending-go store over the shared database, the always-ask source over Knowledge's readAlwaysAsk, the dependencies of the automatic send and of the send with an owner's go, and the sources of the pilot counts. It takes Intake's event bus and hands it to SPEC-11's subscription; it registers no tool (SPEC-16-2, SPEC-16-3). First of four runs.

Last change: 2026-11-24, first draft for the Drafts pilot wiring.

One spec is one agent run: at most 80 lines, 3 files and one done command. Too big: split it into another spec, never add context. A spec decides nothing new.

## Rows

| FR-DRAFTS-02-13 | WHERE | In the local pilot, Deputy shall send an answer that the business knowledge backs without the owner's go, unless its class is in the always-ask list. (R-DRAFTS-22) |
| FR-DRAFTS-02-14 | WHEN | When an owner answer to a question about a customer chat arrives, the answer shall be the go for the next send to that chat within the customer window, and for that one send only. (R-DRAFTS-23) |
| FR-DRAFTS-02-15 | WHEN | When Deputy restarts, a go shall stay until one send uses it or a newer go for the same chat replaces it. (R-DRAFTS-23) |

## Files
| Path | Create or change | Holds |
|---|---|---|
| `src/main/drafts-pilot.ts` | Create | `pilotWiring`: builds the pending-go store, the always-ask source and the dependency bundles |
| `src/main/drafts.ts` | Change | `draftsWiring` calls `pilotWiring` and returns `pilot` |
| `test/main/drafts-pilot-wiring.test.ts` | Create | The composition test below |

## Reuses
- `src/main/drafts.ts` `draftsWiring`: it already builds the unit of work, the chat reader and the approvals; the pilot builder joins it
- `src/drafts/adapters/intake/intake-chat-reader.ts` `IntakeChatReader`: the latest customer message of a chat comes from its `describe`
- `src/drafts/adapters/crypto/uuid-ids.ts` `UuidIds`: new send ids
- Precedent: SPEC-10-2-pending-go-store.md, SPEC-14-knowledge-always-ask.md and SPEC-12-owner-go-send.md, which define the three things this builder assembles

## Tests first
FR-DRAFTS-02-13, FR-DRAFTS-02-14, FR-DRAFTS-02-15, in `test/main/drafts-pilot-wiring.test.ts`, written without the code in view; it builds `draftsWiring` on a temporary database with fake Intake ports and a fake `readAlwaysAsk`. Cases: the always-ask source returns the normalized entries of the injected function and reads it again on every call, so a hand edit shows on the next call (FR-DRAFTS-02-13); a go put in `pilot.pendingGoes` is the same one a transaction of the unit of work takes, so both use one database (FR-DRAFTS-02-14); closing the database and building the wiring again on the same file still holds an unused go (FR-DRAFTS-02-15); `stats.drafts(7)` and `stats.intake(7)` ask their sources for the range `localDayRange(7, now, zone)` of SPEC-08 with the fake clock's now and the zone given to the builder (the range itself is tested in SPEC-08 and SPEC-16-3; here only that the same range reaches both sources); `autoSendDeps.latestCustomerSentAt(chat)` is the time of the chat's latest customer message from the chat reader, and null for an unknown chat; `autoSendDeps` and `ownerGoDeps` are plain objects, so a later spec adds a field to the first without touching the tool registration. Subscription: given a fake `events` with a `subscribe`, `draftsWiring` registers exactly one handler (SPEC-11's `onOwnerAnswered` over `pilot.pendingGoes`), and an `OwnerAnswered` delivered through it puts a go in `pilot.pendingGoes` (FR-DRAFTS-02-14); the reconcile reads the answered questions from the injected `listAnsweredQuestions` before the wiring returns.

## Build
```ts
export type PilotWiring = {
  pendingGoes: PendingGoStore;      // SPEC-10-2; SPEC-11 subscribes onOwnerAnswered to it
  autoSendDeps: AutoSendDeps;       // for sendAnswerTool; one object, a later spec adds a field (the token check)
  ownerGoDeps: OwnerGoDeps;         // for sendOwnerGoTool
  stats: { drafts: (days: number) => Promise<DailyCounts[]>; intake: (days: number) => Promise<IntakeDayCounts[]> }; // each calls localDayRange(days, clock.now(), zone), SPEC-08 (L16)
};
export function pilotWiring(d: { db: SqlDatabase; unitOfWork: UnitOfWork; clock: Clock; chats: ChatReader; readAlwaysAsk: ReadAlwaysAsk; dailyCounts: IntakeDailyCounts; createDraft: CreateDraft; ids: Ids; zone: string; events: IntakeEvents; listAnsweredQuestions: ListAnsweredQuestions }): PilotWiring;
```
`draftsWiring` gains the inputs `readAlwaysAsk` (from `knowledgeWiring`, Knowledge SPEC-04-6), and `dailyCounts`, `listAnsweredQuestions` and `events` (members of Intake's runtime and wiring, Intake SPEC-05-18 and SPEC-05-19; `IntakeEvents` is the type of SPEC-05-18) and returns `{ drafts, approvals, pilot }`. `AutoSendDeps` and `OwnerGoDeps` hold the fields SPEC-12 and SPEC-13 name: the unit of work, `latestCustomerSentAt`, `now`, `newSendId`, `createDraft`, `driveSend` and the window check.

## Done when
`bun test test/main/drafts-pilot-wiring.test.ts`

## Out of scope
The logic of the subscription handler and the reconcile (SPEC-11), registering the tools (SPEC-16-2 and SPEC-16-3) and the start order (SPEC-16-4).

## Open questions
None.

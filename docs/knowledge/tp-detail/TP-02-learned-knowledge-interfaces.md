# TP-02-learned-knowledge: Interfaces

Part of [TP-02-learned-knowledge.md](../tp/TP-02-learned-knowledge.md). Moved verbatim from there; nothing changed.

## Interfaces

Inbound ports (published in `src/knowledge/index.ts`; `Refusal` and the refusal style are in TP-01):

```ts
type Claim = { item: string; field: 'price' | 'availability'; value: string };  // price: plain decimal "12.50"; availability: 'available' | 'unavailable'
type Outcome = 'approved_unchanged' | 'approved_corrected' | 'rejected';
type MessageSnapshot = { text: string; sentAt: string; source: 'customer' } | { unavailable: true };

type DraftOutcome = {                                      // Knowledge's own input type; the MCP adapter maps a Drafts log entry to it
  draftNumber: number; chat: string; answersMessageId: string | null;
  shownText: string | null;                                // the proposed text
  sentText: string | null;                                 // the final text of an approval; null for a rejection
  outcome: Outcome; at: string; entryId: number; ownerWords: string | null };

interface GetLessonScan { execute(): Promise<{ cursor: number }> }   // pure read, no lease
interface ListLessonCandidates { execute(i: { outcomes: DraftOutcome[]; scannedThrough: number | null; limit?: number }): Promise<
  | { ok: true; candidates: { draft: number; chat: string; outcome: Outcome; at: string; entryId: number }[];
      scanned: { upToEntry: number; more: boolean } }
  | Refusal> }                                            // not_owner

interface ProposeLesson { execute(i: { draft: number; situation: string; wanted: string; wording: string; claims?: Claim[]; source: DraftOutcome }): Promise<
  | { ok: true; proposal: number; superseded: number | null; wording: string; situation: string; wanted: string; claims: Claim[];
      source: { chat: string; draft: number; customerMessage: MessageSnapshot } }
  | Refusal> }  // not_owner, draft_not_a_candidate, lesson_already_decided, wording_empty, wording_too_long, field_too_long, claims_invalid, wording_is_customer_text, log_unreadable

interface KeepLesson { execute(i: { proposal: number; wording: string; ownerWords: string }): Promise<
  | { ok: true; lesson: number; alreadyKept: boolean }
  | Refusal> }  // not_owner, proposal_unknown, proposal_closed, proposal_superseded, wording_differs, words_empty, words_copied, which_lesson (with the waiting list), ask_again, words_missing_number (only when several lessons wait)

interface ChangeLesson { execute(i: { lesson: number; wording: string; claims?: Claim[]; ownerWords: string }): Promise<{ ok: true; lesson: number } | Refusal> }
interface DeleteLesson { execute(i: { lesson: number; ownerWords: string }): Promise<{ ok: true } | Refusal> }

type LessonView = {
  number: number; kind: 'currency' | 'price' | 'wording' | 'other'; wording: string; situation: string; wanted: string; learnedAt: string; editedAt: string | null;
  link: { chat: string; draft: number; status: 'ok' | 'draft_missing' | 'log_unreadable' };
  claims: { claim: Claim; result: 'same' | 'differs' | 'unresolved' | 'catalog_unavailable'; marker?: 'catalog_wins_lesson_differs'; catalog?: PriceField | AvailabilityField }[];
  catalog: CatalogItemView[];
};
interface ListLessons { execute(): Promise<{ ok: true; lessons: LessonView[]; count: number; notes: 'lessons_many'[] }> }
```

`DeclineProposal` (TP-01) closes a lesson proposal; it writes `declined` and keeps the row, so the draft is not offered again.

Outbound ports (in `src/knowledge/ports/`):

```ts
interface CustomerMessageReader {                           // adapter: Intake GetMessages({ ids: [id] })
  byId(id: string): Promise<MessageSnapshot>;
}
interface LessonRepository { save(l: Lesson): Promise<void>; get(n: number): Promise<Lesson | null>; remove(n: number): Promise<void>; all(): Promise<Lesson[]> }
interface LessonSourceRepository { addIfAbsent(c: LessonCandidate): Promise<void>; open(limit: number): Promise<LessonCandidate[]>; get(draft: number): Promise<LessonCandidate | null> }
interface KnowledgeState { cursor(): Promise<number>; setCursor(n: number): Promise<void> }
```

`CustomerTextCheck`, `ProposalRepository`, `KnowledgeLogRepository` and `KnowledgeUnitOfWork` are in TP-01.

MCP tools:

| Tool | Input (zod) | Output | Use case | FRs |
|---|---|---|---|---|
| `lesson_candidates` | `{ limit?: int 1..20 }` | drafts the owner approved, corrected or rejected, with outcome and the log texts; `more` | `ListLessonCandidates` | FR-KNOWLEDGE-02-1, FR-KNOWLEDGE-02-2, FR-KNOWLEDGE-02-3 |
| `propose_lesson` | `{ draft, kind, situation, wanted, wording, claims?: Claim[] }` | proposal number, the exact wording, claims, source message in a `<customer_text>` block | `ProposeLesson` | FR-KNOWLEDGE-02-2, FR-KNOWLEDGE-02-4, FR-KNOWLEDGE-02-7 |
| `keep_lesson` | `{ proposal: int, wording: string, owner_words: string (1..1000) }` | lesson number | `KeepLesson` | FR-KNOWLEDGE-02-5, FR-KNOWLEDGE-02-6, FR-KNOWLEDGE-02-7 |
| `change_lesson` | `{ lesson: int, wording: string, claims?: Claim[], owner_words: string }` | lesson number | `ChangeLesson` | FR-KNOWLEDGE-02-8, FR-KNOWLEDGE-02-11 |
| `delete_lesson` | `{ lesson: int, owner_words: string }` | deleted | `DeleteLesson` | FR-KNOWLEDGE-02-8, FR-KNOWLEDGE-02-11 |
| `list_lessons` | none | all kept lessons with link status, claims checked, catalog data | `ListLessons` | FR-KNOWLEDGE-02-8, FR-KNOWLEDGE-02-9, FR-KNOWLEDGE-02-10 |
| `decline_proposal` | (TP-01) | closed | `DeclineProposal` | FR-KNOWLEDGE-02-4 |

The instructions and tool descriptions tell the agent: call `get_profile` and `list_lessons` before drafting; offer lessons from `lesson_candidates` mostly after corrections (FRD open question 5 is left to the agent and the owner); show the exact wording and the customer message; never write a lesson from a customer message. Codes added here: `which_lesson`, `ask_again`, `log_unreadable`, `draft_not_a_candidate`, `lesson_already_decided`, `wording_empty`, `wording_too_long`, `field_too_long`, `claims_invalid`, `wording_is_customer_text`, `wording_differs`, `lesson_unknown`, `lessons_many`, `message_unavailable`, `catalog_wins_lesson_differs`.

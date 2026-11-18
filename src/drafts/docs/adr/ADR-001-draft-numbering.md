# ADR-001: Draft numbers come from a counter row

## Status
Proposed

## Context
FR-DRAFTS-01-1 asks for identifiers that are unique, never reused, shared by reply and order drafts (L5), and short enough for "go on 3". The domain must know the number when it builds the draft and its log entries, and must do no I/O. From TP-01 TD-1. The cross-cutting TP (TD-3) asks for plain SQL that another database adapter can run.

## Decision
- A one-row table `draft_counter(id, last)`. The outbound port `DraftRepository.nextNumber()` runs `UPDATE draft_counter SET last = last + 1` and reads the new value, inside the same unit of work that saves the draft.
- Numbers start at 1, are plain integers, and are never deleted or reused. Closed drafts keep their row.
- The `Draft` aggregate receives its number at creation, so every domain event carries it.

## Alternatives
- `INTEGER PRIMARY KEY AUTOINCREMENT` on `drafts`: the number exists only after the insert, so the aggregate and its events would be built twice. It also ties numbering to one SQL dialect feature.
- `MAX(number) + 1`: safe only while no row is ever removed. One future cleanup would reuse a number.
- Random short names ("blue-fox"): harder for the owner to type and say than "3".
- A display number given at listing time: it changes when drafts close, so "go on 3" could name a different draft than the owner saw.

## Consequences
- Easier: the number is a domain value; tests use an in-memory counter.
- Harder: one extra write per draft, in the same transaction as the insert. A rolled-back transaction rolls back the counter too, so no number is lost.

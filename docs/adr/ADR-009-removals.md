# ADR-009: Remove the push-and-answer model

## Status
Proposed

## Context
The FRDs and decisions contradict the current code in 20 places (`docs/research/codebase.md`, C1 to C20). PRODUCT section 6 says the `operator/` profile is removed. D1 and FR-DRAFTS-02-7 forbid any send path except an approved draft. From TP TD-9.

## Decision
Remove:
- `operator/` and `scripts/operator.sh` (owner decision);
- the permission relay and the `lang` setting (C5, C19);
- the `reply`, `create_order`, `handoff`, `resume` and `notify_owner` tools (C1, C3, C4, C6);
- per-message push with customer text (C7);
- the echo pause and `conversations.ts` with `state.json` (C6, C15, C16);
- `providers/meta.ts` (C9).

Tests: `test/e2e.test.ts` is rewritten per slice. The relay and Meta tests are deleted; the dev-flow test becomes draft, go, send; the Kapso test becomes signature check plus catch-up. The harness stays. `test/unit.test.ts` stays. `README.md`, `README.es.md` and `CLAUDE.md` are updated together (C20).

The old structure is not kept (ADR-000). Small pieces move into adapters: `splitText`, the HMAC check, the CSV parser, the Google JWT helper.

## Alternatives
- Keep some behind flags: two products in one repo, and `reply` and `notify_owner` would remain send paths outside a draft.
- Migrate in steps, keeping the old tools until each replacement passes: two sending models for a while; acceptable only on a branch that is never released.

## Consequences
- Easier: one send path; less code to defend.
- Harder: no "answer on its own" mode until autopilot rules exist (not in v1).
- Watch: the removed `operator/` lock-down was a useful reference; the deny-list advice moves to Setup (FR-SETUP-03-7).

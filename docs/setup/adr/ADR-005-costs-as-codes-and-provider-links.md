# ADR-005: Costs are shown as codes and provider links, with no figures kept

## Status
Proposed

## Summary

`ShowCosts` returns fixed items: `free_plan_limits`, `whatsapp_fees_separate`, `daily_limit_unverified_name` and `payment_problem`, each with a code, an English default text and, where it applies, a link from the provider adapter's guide table.

## Context
FR-SETUP-02-1: the free plan and its limits are shown as the provider shows them at that moment, not as figures kept in Setup. The research documents no endpoint for plan limits or payment status (`docs/research/kapso.md` Q1). From Setup TP-02, TD-2.

## Decision
`ShowCosts` returns fixed items: `free_plan_limits`, `whatsapp_fees_separate`, `daily_limit_unverified_name` and `payment_problem`, each with a code, an English default text and, where it applies, a link from the provider adapter's guide table. No plan figure, price or limit is written in Setup. The agent opens the linked page and reads the figures to the owner. For a payment problem the text says what the owner can do on the provider's page and that Deputy does not pay or fix it.

## Options considered
- Read the figures from an API: none is documented, so the first run would fail on an assumed endpoint.
- Write the figures in Setup: wrong the day the provider changes a plan, which FR-SETUP-02-1 forbids.

## Consequences
- Easier: a stale figure cannot exist; a new provider adds one table.
- Harder: the owner reads figures on another page.
- Watch: links go stale; a launch gate opens each one.

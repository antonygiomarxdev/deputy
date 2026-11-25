# ADR-008: A secret shows its last four characters only when it has 20 or more

## Status
Accepted (2026-11-25)

## Summary

A pure function in `domain/` shows `present, ends ...abcd` only when the secret has at least 20 characters.

## Context
FR-SETUP-03-4: Setup shows secrets back only in part, the last four characters for long secrets and only present or absent for short ones. The FRD does not say where "long" starts. A fragment of a short secret helps a guess. From Setup TP-03, TD-1.

## Decision
A pure function in `domain/` shows `present, ends ...abcd` only when the secret has at least 20 characters. Below 20 it shows `present` or `absent`. Four of 20 hide 16 characters. The adapter computes the last four and returns them with the status; they are never stored. The same rule serves `check_secrets` and `setup_status`.

## Options considered
- Never show any part: the owner cannot tell two keys apart or see that a rotation took effect.
- Always show the last four: a 6-character secret would show two thirds of itself.

## Consequences
- Easier: one rule, one test at lengths 0, 1, 19, 20 and 64.
- Harder: a provider key shorter than 20 characters shows only present, which is safe but less useful.
- Watch: the real key lengths on Kapso are not known; the rule holds for any length.

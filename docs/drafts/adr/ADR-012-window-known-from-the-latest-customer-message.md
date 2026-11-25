# ADR-012: The 24-hour window is counted from the customer's latest message

## Status
Accepted (2026-11-25)

## Summary

The window closes at `latestCustomer.sentAt + CUSTOMER_WINDOW_MS` (24 hours, WhatsApp's rule, a domain constant).

## Context
Owner decision D29: if the retry time falls outside WhatsApp's 24-hour customer window, the send fails at once and the owner is told. Deputy needs to know when the window closes. Intake already keeps the customer's latest message per chat (`lastCustomerAt`) and Drafts reads it through `ChatReader.describe(chat).latestCustomer`. From TP-03 TD-3.

## Decision
- The window closes at `latestCustomer.sentAt + CUSTOMER_WINDOW_MS` (24 hours, WhatsApp's rule, a domain constant).
- Drafts uses the existing Intake read. No new Intake port is added.
- The check runs when the `429` arrives and again at each retry. A retry time after the close fails the draft with `fail_window_closed` and no timer is set.

## Options considered
- A new Intake port for the window: the data is already in `ReadChat`.
- No window check, retry until the provider refuses: the provider refuses a send outside the window, and the owner would wait for nothing.

## Consequences
- Easier: one constant, no new port.
- Harder: the window follows the provider's rule; if WhatsApp changes it, one constant changes.
- Watch: a customer message that reaches Deputy late moves the window later, which is safe.

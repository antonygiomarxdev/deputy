# ADR-008: A chat is ignored by its exact identifier

## Status
Accepted (2026-11-24)

## Summary

`ignore_chat` and `unignore_chat` take one exact chat identifier, the one the summary showed. Deputy refuses any value that is not a known chat (`unknown_chat`) and ignores nothing.

## Context
The owner says "ignore Juan's chat" (FR-INBOX-03-1, FR-INBOX-03-3). Intake will store the provider's profile name only as an untrusted display hint (`ChatStateView.profileName`), and a WhatsApp profile name is typed by the customer. A chat's identifier is the customer's line key. From TP-03 TD-1.

## Decision
- `ignore_chat` and `unignore_chat` take one exact chat identifier, the one the summary showed. Deputy refuses any value that is not a known chat (`unknown_chat`) and ignores nothing.
- The agent maps the owner's words to the identifier and asks the owner which chat when more than one could be meant. This duty is in the tool description.
- Deputy keeps no name, fragment or wildcard matching.

## Options considered
- Deputy matches typed numbers or fragments: a typed number needs Intake's country-aware parsing, which is not a published port, and a digit fragment can match several chats and hide the wrong customer.
- Deputy matches on the profile name: a customer can name themself like another customer, so "ignore Juan" could hit the wrong chat.

## Consequences
- Easier: nothing ambiguous reaches the list; the test is a refusal.
- Harder: the agent resolves the owner's words from the number and name shown in the summary.
- Watch: the profile name helps the agent and the owner read the list, labeled as customer text; it must never be the key.

# ADR-006: Customer text is escaped inside its label

## Status
Proposed

## Summary

The use case returns raw strings. The MCP adapter writes them inside `<customer_text>` after replacing `&` with `&amp;`, `<` with `&lt;` and `>` with `&gt;`. The helper is `src/adapters/mcp/customer-text.ts`, used by every tool that returns customer text.

## Context
FR-INBOX-02-10 and R-INBOX-8: everything from a customer is labeled as customer text so the agent treats it as data. The cross-cutting TP wraps customer fields in `<customer_text>...</customer_text>` but does not say what happens when the text itself contains that tag. From TP-02 TD-3.

## Decision
- The use case returns raw strings. The MCP adapter writes them inside `<customer_text>` after replacing `&` with `&amp;`, `<` with `&lt;` and `>` with `&gt;`. The helper is `src/adapters/mcp/customer-text.ts`, used by every tool that returns customer text.
- The structured result keeps the raw string in a JSON field, where it cannot close a tag.
- Labeled fields: excerpts, transcripts, the chat identifier, and any longer view of a chat.

## Options considered
- A random nonce per response: needs a random source through a port, makes output unstable in tests, and makes the label longer.
- Stripping `<` and `>`: changes data the owner must read, such as a quantity written `<5kg`.

## Consequences
- Easier: one small function with one test for the closing-tag attack; stable output.
- Harder: the agent reads `&lt;` where a customer typed `<`.
- Watch: the same helper must serve Intake's `get_chat` and Drafts' `list_drafts`; flagged for the cross-cutting TP.

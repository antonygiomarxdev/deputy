# ADR-011: The agent judges a closing "ok" or "thanks"

## Status
Proposed

## Summary

Pending detection does not change. It stays a pure function of times (ADR-001).

## Context
Owner decision D23: a short reply such as "ok" or "thanks" after an answer does not make a chat pending when the agent is sure the chat is closed. When it is not sure, it asks the owner. A word list per language (D20) would be wrong somewhere and would hide real messages such as "ok, send it". From TP-01 TD-4.

## Decision
- Pending detection does not change. It stays a pure function of times (ADR-001).
- Each pending item carries `followsAnswer`. The tool description states the rule for the agent: skip the chat only when the latest customer text plainly closes it; otherwise ask the owner.
- `CountWaiting` still counts the chat.

## Options considered
- A word list or a length rule in code: wrong in some language, and a wrong hide is silent.

## Consequences
- Easier: no list to keep; any language works.
- Harder: the outcome depends on the agent's judgment.
- Watch: a skipped chat comes back in the next summary, so a wrong skip costs one question, not a lost message.

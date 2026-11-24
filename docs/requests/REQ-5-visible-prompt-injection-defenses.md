# REQ-5: Make prompt-injection defenses visible

Status: Open
Links: [Label customer text as data in every tool output](https://github.com/antonygiomarxdev/deputy/issues/150), [State the defenses in the README with built and not-built marks](https://github.com/antonygiomarxdev/deputy/issues/151)

## Summary

Customer messages are untrusted text that an agent reads. The owner wants the defenses stated clearly: what is built and what is not.

Last change: 2026-11-24, first draft from the owner's words

## Who asked and when
The owner, 2026-11-24, in a Claude Code session.

## What they said
The owner asks that prompt injection is stated clearly.

## The problem behind it
A customer can write instructions inside a message. If tool output does not mark that text as data, the agent may follow it.

## Evidence
Unknown. The first step of the tracking issue is an audit of which tool outputs return customer text without a label.

## Decision
Open. Waits for the owner.

# ADR-001: One MCP server over stdio; tools and instructions are the core

## Status
Proposed

## Context
Deputy must work with any agent that speaks MCP (principle 4). Only tools are confirmed in every client checked; `instructions` are confirmed for Claude Code, Codex and Gemini CLI. Claude Code channel push needs `--dangerously-load-development-channels` and may change (`docs/research/agents.md`). From TP TD-1.

## Decision
- One MCP server over stdio. The core is tools plus server `instructions`.
- Key rules are repeated in tool descriptions. The first 512 characters of `instructions` stand alone.
- Claude Code channel push is an optional extra behind the `push_on` setting. The tool path is identical with it off.
- The permission relay is removed. The owner's go is given in the conversation (D1).

## Alternatives
- A CLI the agent shells out to: needs a shell, which is the bypass D11 warns about.
- Channel-first: Claude Code only, needs the development flag, breaks principle 4.

## Consequences
- Easier: one code path for every agent; setup works with push off.
- Harder: no wake-up of an idle session without push; the owner asks "what is pending?" or relies on notices where push works.
- Watch: the channel contract and the 2026-07-28 protocol revision; the unverified 30-minute idle timeout.

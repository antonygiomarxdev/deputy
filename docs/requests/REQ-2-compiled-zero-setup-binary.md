# REQ-2: A compiled binary nobody has to start by hand

Status: Open
Links: [Build the release pipeline](https://github.com/antonygiomarxdev/deputy/issues/142)

## Summary

The owner wants Deputy to be one compiled file with one install line, so nobody has to start or host anything by hand.

Last change: 2026-11-24, first draft from the owner's words

## Who asked and when
The owner, 2026-11-24, in a Claude Code session.

## What they said
The owner asks for a compiled binary, so nobody has to start or host anything by hand.

## The problem behind it
Today Deputy runs from source with Bun and the CLI has only `serve`. A small business owner will not set up a runtime, a service or a host.

## Evidence
Competitors: lharries/whatsapp-mcp needs two processes, BrOrlandi/whatsapp-mcp-server needs a VPS and Docker, OpenClaw needs a daemon. A single compiled binary is a gap in this group (competitive scan, 2026-11-24).

## Decision
Open. Waits for the owner.

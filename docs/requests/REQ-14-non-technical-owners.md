# REQ-14: Non-technical owners can use Deputy

Status: Open
Links: [Read settings and secrets from environment variables too](https://github.com/antonygiomarxdev/deputy/issues/180), [Package Deputy as a Claude Desktop extension (.mcpb)](https://github.com/antonygiomarxdev/deputy/issues/181), [Test the unsigned package on a clean Windows and macOS machine](https://github.com/antonygiomarxdev/deputy/issues/182), [Enter owner numbers in the install form and read them back](https://github.com/antonygiomarxdev/deputy/issues/183), [Review every tool text and error in Spanish, plain words first](https://github.com/antonygiomarxdev/deputy/issues/184), [Offer MCP prompts as one-tap modes for pending and replying](https://github.com/antonygiomarxdev/deputy/issues/185), [Choose and set up code signing for macOS and Windows](https://github.com/antonygiomarxdev/deputy/issues/186), [Give Claude Desktop owners a pull-based daily digest instead of push](https://github.com/antonygiomarxdev/deputy/issues/187), [Build Setup](https://github.com/antonygiomarxdev/deputy/issues/138), [Build deputy secrets and deputy config commands](https://github.com/antonygiomarxdev/deputy/issues/137), [Build the release pipeline](https://github.com/antonygiomarxdev/deputy/issues/142), [Support ChatGPT with an easy setup](https://github.com/antonygiomarxdev/deputy/issues/192), [Mark read-only tools with readOnlyHint](https://github.com/antonygiomarxdev/deputy/issues/193)

## Summary

The owner asks that people who are not technical can use Deputy. Today the path needs a runtime, git, a terminal command, two hand-edited files and eight technical concepts. The target for Claude Desktop is an extension: download, double-click, fill a form, connect the number with a link, test. No terminal and no file. ChatGPT, the most used agent, must be supported with the same easy setup (decided by the owner). Daily use is pull-based, in plain Spanish.

Last change: 2026-11-24, owner decided ChatGPT must be supported

## Who asked and when
The owner, 2026-11-24, in a Claude Code session.

## What they said
The owner asks to improve the product so that non-technical people can use it.

The owner adds that ChatGPT is the most used agent and its setup must work without much trouble.

The owner notes that the people who want this are usually non-technical.

## The problem behind it
The README Quick start needs six terminal steps (install Bun, clone, install, add the server by absolute path, set owner numbers, optional tunnel for live mode), two hand-edited files (the config and the secrets file) and eight technical concepts. The Setup slice promises under 30 minutes, which cannot be met: Setup has documents only, the secrets and config commands are not built and there is no binary. Owner numbers are entered in a terminal by design (ADR-006, D19), so they cannot be zero-terminal either.

## Evidence
- A Claude Desktop extension (.mcpb) installs by double-click, asks for settings in a form, stores masked values in the system store and passes them to the server as environment variables. It works on macOS and Windows and needs one compiled binary per OS.
- ChatGPT connects only to remote MCP servers (public HTTPS, OAuth or none), so a local Deputy does not reach ChatGPT web without a second transport and a tunnel; a hosted relay goes against principle 8. Codex (desktop, CLI, IDE) supports local stdio servers on every ChatGPT plan, through a command or a config file. Full MCP with write actions is documented for Business and Enterprise; write access on Plus is unverified.
- ChatGPT and Codex treat tools without readOnlyHint as writes and prompt on every read.
- Claude Desktop and ChatGPT have no known local-server push, so Notify cannot reach these owners; a pull-based digest and one-tap prompts replace it.
- Kapso offers a setup link the owner opens to connect a number. Catch-up needs no public URL, so tunnels stay an advanced mode.
- Not checked: Windows signing price, SmartScreen and Gatekeeper behavior for an unsigned package, whether Claude Desktop shows MCP prompts as a menu, extension signing rules, whether the Kapso setup link needs a Kapso account, ChatGPT Plus support.

## Decision
Open. Waits for the owner to accept. Decided by the owner: ChatGPT must be supported with an easy setup. Step one is Codex (local stdio); step two is ChatGPT web (second transport, authentication, tunnel), tracked in the ChatGPT issue. Still open: Apple notarization at 99 USD a year before launch, accepting a delay of a few minutes (catch-up) as the default, and tu or vos in Spanish copy (#159).

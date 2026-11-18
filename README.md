# Deputy

**Your WhatsApp Business inbox inside your own agent.** Deputy shows your agent the messages your customers send, helps it sort them and research what it needs, and lets you decide what goes out.

Deputy is an [MCP](https://modelcontextprotocol.io) server that runs on your computer and talks to your agent over stdio (Claude Code first; any MCP agent works). It is an assistant, not an autonomous bot: nothing is sent without your explicit go.

[Leer en español](README.es.md)

## How it works

- **Providers:** [Kapso](https://kapso.ai) (free plan, works with a number that stays in the WhatsApp Business app) and `dev` (local testing, no WhatsApp). Adding a provider means implementing the `Provider` port in `src/intake/ports/provider.ts`.
- **Your data stays yours:** conversations live in one SQLite file, `deputy.db`, on your machine.
- **One owner process:** only one Deputy process at a time holds the lease on `deputy.db` and does the work; a second one is read-only.
- **Official APIs only:** no unofficial WhatsApp bridges.

The product, its principles and its scope are in [docs/PRODUCT.md](docs/PRODUCT.md).

## Status

**v0.1, experimental, being rebuilt.** The foundation is in place: the MCP stdio server with its `status` tool, the owner lease, the SQLite store and migrations, the owner numbers, the start-up checks, and the Kapso and `dev` providers. Receiving and storing messages, the inbox, drafts and approval, notices and setup commands follow slice by slice (see the slice map in [docs/PRODUCT.md](docs/PRODUCT.md)). Nothing here has run against real WhatsApp traffic yet.

## Quick start

Requirements: [Bun](https://bun.sh) 1.4 or newer.

```bash
git clone https://github.com/antonygiomarxdev/deputy && cd deputy
bun install
bun test              # unit, contract and end-to-end tests
bun run typecheck     # tsc --noEmit
bun src/main.ts serve # the MCP server over stdio
```

Add it to Claude Code (any MCP agent has an equivalent):

```bash
claude mcp add deputy -- bun /absolute/path/to/deputy/src/main.ts serve
```

`serve` does not yet read the provider settings or build a provider; that wiring comes with the receive-and-store slice. Stdout is the MCP transport; logs go to stderr.

## Configuration

| Where | What |
|---|---|
| `DEPUTY_DATA_DIR` (default `data`) | Holds `deputy.db`, your conversations and settings. Back-ups of it before a migration are `deputy.db.bak-v<N>`. |
| `DEPUTY_CONFIG_DIR` (default `~/.deputy`) | Holds `config.json` and `secrets.env`. |
| `DEPUTY_PORT` (default `8788`) | Listener port for live delivery. Reserved: live receiving is not built yet. |

`config.json` takes `provider` (`kapso` or `dev`; empty means `dev`), `receiving_mode` (`catch-up` or `live`) and, for Kapso, `kapso_phone_number_id`. Secrets are read from the operating system's secret store, then from `secrets.env` (`name=value` lines): `kapso-api-key` and `kapso-webhook-secret` (only for `live`). `serve` does not read either file yet (the readers are built and tested). Setup commands that write them are not built either, so edit them by hand for now. The start-up check that refuses a missing item, names it and never prints a secret is built (`ResolveProviderSettings`) but `serve` does not call it yet.

## Security

Every customer message is untrusted input to your agent. These are design rules, built slice by slice.

Holding today:

1. Secrets are shown as `[secret]` everywhere and never put in errors or logs.
2. Changes to your owner numbers are kept in an append-only log: the database refuses edits and deletes of it.

Not built yet:

3. Customer text reaching the agent labeled as data, never as instructions.
4. Nothing sent without `approve_draft` and your go naming the draft.
5. Only your own numbers counting as you, with changes to them only through the command line, never through an agent tool.

Known limit: Deputy guards only its own send path, so an agent that has other tools can bypass it. Run it with an agent whose tools you trust.

## Development

```bash
bun install
bun test
bun run typecheck
```

See [CLAUDE.md](CLAUDE.md) for the layout and conventions. Releases use [Changesets](https://github.com/changesets/changesets).

## License

[Apache-2.0](LICENSE). Not affiliated with Anthropic or Meta. WhatsApp is a trademark of Meta Platforms, Inc.

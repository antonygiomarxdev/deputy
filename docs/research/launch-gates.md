# Launch gates

Verified 2026-11-18. The example values in the evidence lines (phone number, country, currency) were neutralized after the run; the results are unchanged. Bun 1.4.4, Windows 11 Home 10.0.26300 (x64). Compiled with `bun build --compile gates.ts --outfile gates.exe`. Deps: jose 6.2.17, libphonenumber-js 1.13.16, papaparse 5.7.1, country-to-currency 3.0.2. Script and outputs: scratchpad `gates/` (`gates.ts`, `src.txt`, `bin.txt`). Source and compiled outputs were identical line for line.

| Gate | Source | Compiled | Evidence (command and exact output line) |
|---|---|---|---|
| 1. `Bun.secrets` set/get/delete | pass | pass | `Bun.secrets.set/get/delete({service:"deputy-gate-test",name:"dummy"})` -> `1.secrets: {"got":true,"deleted":true,"afterDelete":null}` |
| 2. `bun:sqlite`: secure_delete, user_version migration, WAL | pass | pass | `2.sqlite: {"sd":{"secure_delete":1},"jm":{"journal_mode":"wal"},"v0":{"user_version":0},"v1":{"user_version":1}}` |
| 3. jose RS256 JWT -> Google token endpoint | pass | pass | `3.jose: {"status":400,"body":"{\"error\":\"invalid_grant\",\"error_description\":\"Invalid grant: account not found\"}"}` |
| 4a. `Bun.spawn(["npx.cmd","--version"])` | works | works | `4.npx.cmd: {"code":0,"out":"11.19.1","err":""}` |
| 4b. `Bun.spawn(["npx","--version"])` | works | works | `4.npx: {"code":0,"out":"11.19.1","err":""}` |
| 4c. `Bun.spawn(["npx.exe",...])` | fails | fails | `4.npx.exe: FAIL Executable not found in $PATH: "npx.exe"` (no such file; expected) |
| 4d. `Bun.spawn(["cmd","/c","npx","--version"])` | works | works | `4.shell:true-ish(cmd /c): {"code":0,"out":"11.19.1"}` |
| 5a. libphonenumber-js | pass | pass | `5.libphonenumber: {"country":"US","intl":"+1 212 555 0105","valid":true}` |
| 5b. papaparse | pass | pass | `5.papaparse: [{"a":"1","b":"2"}]` |
| 5c. country-to-currency | pass | pass | `5.country-to-currency: {"US":"USD","IN":"INR"}` |
| 6a. `Intl.supportedValuesOf('currency')` | pass | pass | `6.currency: {"n":307,"hasUSD":true,"hasINR":true}` |
| 6b. Time zones Chicago / Kolkata | pass | pass | `6.tz: {"chicago":"01/06/2026, 07:00:00 GMT-5","kolkata":"01/06/2026, 17:30:00 GMT+5:30"}` (input 2026-06-01T12:00Z) |
| 6c. `Intl.Segmenter` graphemes | pass | pass | `6.segmenter: {"graphemes":4,"codepoints":9}` for `a`, family emoji, `é`, flag |

Notes:
- Bare `npx` and `npx.cmd` both resolve through Bun's PATH lookup on Windows. Use `npx.cmd` to be explicit.
- Gate 3 proves the path (TLS, fetch, JWT signing in the binary). Google answered `invalid_grant` for the throwaway key, as expected.
- Dummy secret deleted. Confirmed gone with a fresh process: `after: null`.

## Not tested
- macOS and Linux (`Bun.secrets` backends Keychain / libsecret): only this Windows machine was available. On Windows it uses Credential Manager.
- Cross-compiled binaries (`--target`): not built.
- A real Google service-account exchange (no real credentials by instruction), so scope, quota and clock-skew behaviour are untested.
- `PRAGMA secure_delete` was read back, but physical erasure of freed pages in the file was not inspected.
- Running the binary on a machine without Bun or Node installed: the binary was run here, where both exist. The `npx` spawn gate needs Node on PATH by definition.

## Kapso field paths awaiting a live check

Open until the owner's live check confirms or replaces them (SPEC-01 Context, L8). The adapter holds the safe reading meanwhile.

| Item | Adapter reads | Why it is open |
|---|---|---|
| Sender profile name | nothing: `profileName` is null | `kapso.contact_name` is not in SPEC-01's Context table or in `docs/research/kapso.md`. The reference page shows it on a message record, but it was not confirmed for live deliveries. |

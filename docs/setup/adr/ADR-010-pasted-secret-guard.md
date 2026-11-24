# ADR-010: Owner words that contain a stored secret are refused

## Status
Accepted (2026-11-18)

## Context
FR-SETUP-03-3: if the owner pastes a secret into the conversation, the agent tells the owner not to, and the pasted value is not used. The FRD says Deputy cannot detect it, so it is the agent's behavior. From Setup TP-03, TD-3.

## Decision
Every Setup tool that takes the owner's words (`setup_confirm`, `setup_answer`, `setup_owner_number`, `setup_profile`) first asks a read-only port, `SecretLeakGuard.contains(text)`. Its adapter compares the text with the stored secrets and returns only true or false, so Setup never sees a value. On true the call is refused with `secret_in_words` and nothing is stored; the reply tells the agent to say the secret must be replaced on the provider's page. The guide text still teaches the agent to refuse a pasted secret, and Setup still does not claim to detect passwords or codes it never stored.

## Alternatives
- Guide text only: relies on the agent noticing.
- Pattern rules for code-like strings: false hits on prices, phone numbers and quantities would block ordinary catalog and order words.

## Consequences
- Easier: a cheap, testable layer that cannot be wrong in the harmful direction.
- Harder: one more port, and a second place that reads secrets.
- Watch: it catches only an exact paste of a stored secret; a reformatted key or a verification code passes.

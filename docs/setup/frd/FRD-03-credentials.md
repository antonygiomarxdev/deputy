# FRD-03: Credentials and safety

Status: Approved (2026-11-25) · Slice: Setup · Part of [Setup PRD](../PRD.md)
Approval: content BSNIj-PPdqM3; rests on ../PRD.md SshZ554utN5k

Deferred (REQ-15, 2026-11-24): the local pilot enters the Kapso key in a Deputy form instead of the steps here (D33). The document stays as written.

## Summary

The owner's passwords, codes and payment details never pass through the agent. The two secrets Deputy needs are entered by the owner in a place the agent does not read, and never shown back in full. Setup never loosens the rule that nothing goes out without an approved draft. See [../PRD.md](../PRD.md).


Last change: 2026-11-24, format 4: a Why section, rules and examples, quality criteria and the n/a references added from the existing text; rows gain "shall"; returned to Draft.

## Why

The slice PRD's requirements R-SETUP-13 to R-SETUP-15: the owner's passwords, codes and payment details never pass through the agent, and nothing goes out without an approved draft.

## Requirements covered

R-SETUP-13, R-SETUP-14, R-SETUP-15.

## Behavior

Step 4 is the credentials step: the owner enters the two secrets, and the check says the provider accepts them and Deputy can reach the connected number.

| ID | Pattern | Requirement |
|---|---|---|
| FR-SETUP-03-1 | always | Setup shall never ask the agent to enter, read or hold the owner's passwords, verification codes or payment details. Setup shall never ask the owner to type or paste them into the agent conversation. Each instruction that involves them shall say where the owner types them: the provider's or the phone's own screen. |
| FR-SETUP-03-2 | always | Deputy shall need the provider's access key. For live delivery (optional, FRD-02) it also needs the secret that proves incoming messages come from the provider. Setup shall tell the owner where to get each on the provider's pages and where to put it: a local place on the owner's machine. The agent shall not read it, because the locked-down agent profile denies that path. With any other agent, the owner must restrict that path themselves. This is the known limit: an agent with file tools of its own could read it, and Setup shall say so. Deputy shall offer a plain way to open that place and show which lines the owner must fill, with no secret in the view. |
| FR-SETUP-03-3 | IF | If the owner pastes a secret, password or code into the agent conversation, the agent shall tell the owner not to do that, and Setup shall tell the owner to replace that secret on the provider's page. The pasted value shall not be used: nothing in Setup shall read a secret from the conversation. Spotting the paste is the agent's behavior, taught by the setup guide text. Deputy cannot detect it. |
| FR-SETUP-03-4 | always | The secrets shall be stored on the owner's machine only. Setup shall show them back only in part (the last four characters for long secrets, nothing but present or absent for short ones) and shall say whether each is present. |
| FR-SETUP-03-5 | always | Secrets shall never be written to chat logs, status output, or any document the owner might share, and never sent to a customer. |
| FR-SETUP-03-6 | always | The check for secrets shall say whether each is present and accepted by the provider. It shall say nothing about their value. |
| FR-SETUP-03-7 | always | Setup shall not change any setting of the owner's agent that would let it send without an approved draft. If the owner asks for that (for example "always allow"), Setup shall refuse and say the approval is the owner's go in the conversation. |
| FR-SETUP-03-8 | IF | If a step would need such a setting, Setup shall not run the step and shall tell the owner why. |


## Rules and examples

The rules are the behavior rows above, one rule per row. The examples are written from each rule's text and from the existing acceptance tests and edge cases of this document. Every rule has a positive example and a negative or boundary example.

| Rule | Text | Covers |
|---|---|---|
| RULE-1 | no password, verification code or payment detail passes through the agent | FR-SETUP-03-1 |
| RULE-2 | the access key is kept in a local place the agent does not read | FR-SETUP-03-2 |
| RULE-3 | a pasted secret is not used | FR-SETUP-03-3 |
| RULE-4 | secrets are stored on the owner's machine and shown only in part | FR-SETUP-03-4 |
| RULE-5 | secrets are never written to logs, status output or shared documents | FR-SETUP-03-5 |
| RULE-6 | the secret check says present or accepted, never the value | FR-SETUP-03-6 |
| RULE-7 | Setup never loosens the rule that nothing goes out without an approved draft | FR-SETUP-03-7, FR-SETUP-03-8 |

| ID | Rule | Kind | Given | When | Then |
|---|---|---|---|---|---|
| EX-1 | RULE-1 | positive | Step 4 is in progress | the full setup conversation and the files are reviewed | they hold no owner password, verification code or payment detail |
| EX-2 | RULE-1 | negative | The owner pastes a verification code into the chat | the agent handles it | the agent does not use it, tells the owner to ignore the code and that it may need to be requested again, and Setup records no copy of it |
| EX-3 | RULE-4 | positive | The owner enters the access key in the local place | the agent asks for the setup status | the status says the key is present and shows at most its last four characters |
| EX-4 | RULE-2 | positive | The locked-down agent profile | its deny list is read | it covers the path of the secrets |
| EX-5 | RULE-3 | positive | The setup guide text is reviewed | it is checked | it tells the agent to refuse pasted secrets and to tell the owner to replace them |
| EX-6 | RULE-3 | negative | The owner pastes a secret into the chat | Setup runs its checks | Setup does not read the value from the conversation |
| EX-7 | RULE-5 | positive | Setup is complete | logs and status output are searched for the secrets | neither appears in the clear |
| EX-8 | RULE-4 | boundary | The owner shares a screenshot of their setup | the status is shown | only the partial form appears, so nothing in it can be used |
| EX-9 | RULE-6 | positive | The access key was revoked | the check runs | it fails and says the key is not accepted, without showing the key |
| EX-10 | RULE-2 | negative | The owner cannot find the local place | Setup explains how to find it | it explains how to open it and never offers to take the secret through the conversation |
| EX-11 | RULE-6 | positive | The access key is wrong or revoked | the check runs | it fails with "the provider does not accept the key" |
| EX-12 | RULE-6 | boundary | The owner rotates a secret later | Setup re-runs the check | it says whether the new one works |
| EX-13 | RULE-7 | positive | The owner asks to let the agent send without asking | Setup responds | it refuses and changes nothing |
| EX-14 | RULE-7 | negative | A step would need a setting that lets the agent send without an approved draft | Setup reaches that step | it does not run the step and tells the owner why |
| EX-15 | RULE-5 | negative | Setup is complete | the status output is read | the secrets do not appear in the clear |

## Decision table

n/a: the rules have no combination of conditions that changes the outcome, so no decision table is needed.

## States

n/a: no status or transition is defined in this FRD; a secret is either present or absent (FR-SETUP-03-4).

## Invariants

n/a: docs/INVARIANTS.md holds no row that names this FRD's rules yet.

## Quality criteria

| ID | Characteristic (ISO/IEC 25010) | Criterion |
|---|---|---|
| QC-1 | Functional suitability | Every FR-SETUP-03 row and every EX row is cited by at least one test; `check.ts trace` reports no uncited id. |
| QC-2 | Performance efficiency | n/a: the existing text states no timing target. |
| QC-3 | Compatibility | n/a: the existing text states no platform target beyond the locked-down agent profile. |
| QC-4 | Interaction capability | n/a: the existing text states no interaction target. |
| QC-5 | Reliability | A revoked key fails the check without a value in the output (FR-SETUP-03-6): the test revokes the key and finds the check says not accepted and shows no value. |
| QC-6 | Security | Secrets are never written to logs, status output or shared documents (FR-SETUP-03-5): the test searches the logs, the status output and the documents and finds no secret. |
| QC-7 | Maintainability | n/a: the existing text states no maintainability target beyond the repository rules. |
| QC-8 | Flexibility | A rotated secret is checked again (Edge cases, FRD-03): the test rotates a secret and finds the check runs again. |
| QC-9 | Safety | Setup never loosens the approval rule (FR-SETUP-03-7): the test asks for "always allow" and finds the refusal and no setting changed. |

## Cross-cutting

n/a: docs/CROSS-CUTTING.md has no filled row for Setup; the cross-cutting rules live in docs/tp/TP.md.

## Edge cases

- The owner pastes a verification code into the chat: the agent does not use it, tells the owner to ignore the code and that it may need to be requested again, and Setup records no copy of it.
- The access key is wrong or revoked: the check fails with "the provider does not accept the key", and the owner is told to enter a new one in the same local place.
- The secret that proves incoming messages differs between Deputy and the provider: the test message does not arrive, and the check says the two secrets do not match.
- The owner shares a screenshot of their setup with someone: the status shows only the partial form, so nothing in it can be used.
- The owner rotates a secret later: Setup re-runs the check and says whether the new one works.
- The owner cannot find the local place: Setup explains how to open it, and never offers to take the secret through the conversation instead.

## Information

- Whether each secret is present, and whether the provider accepted it.
- The last four characters of each secret, for display.
- The time each was last checked.

## Open questions

1. Which exact place is the local place, and what is the simplest way for a non-technical owner to open it on each system? (TP)

## Acceptance criteria

Generated from the examples above, one per EX row:

- AC-1: Given step 4 is in progress, When the full setup conversation and the files are reviewed, Then they hold no owner password, verification code or payment detail. (EX-1)
- AC-2: Given the owner pastes a verification code into the chat, When the agent handles it, Then the agent does not use it, tells the owner to ignore the code and that it may need to be requested again, and Setup records no copy of it. (EX-2)
- AC-3: Given the owner enters the access key in the local place, When the agent asks for the setup status, Then the status says the key is present and shows at most its last four characters. (EX-3)
- AC-4: Given the locked-down agent profile, When its deny list is read, Then it covers the path of the secrets. (EX-4)
- AC-5: Given the setup guide text is reviewed, When it is checked, Then it tells the agent to refuse pasted secrets and to tell the owner to replace them. (EX-5)
- AC-6: Given the owner pastes a secret into the chat, When Setup runs its checks, Then Setup does not read the value from the conversation. (EX-6)
- AC-7: Given Setup is complete, When logs and status output are searched for the secrets, Then neither appears in the clear. (EX-7)
- AC-8: Given the owner shares a screenshot of their setup, When the status is shown, Then only the partial form appears, so nothing in it can be used. (EX-8)
- AC-9: Given the access key was revoked, When the check runs, Then it fails and says the key is not accepted, without showing the key. (EX-9)
- AC-10: Given the owner cannot find the local place, When Setup explains how to find it, Then it explains how to open it and never offers to take the secret through the conversation. (EX-10)
- AC-11: Given the access key is wrong or revoked, When the check runs, Then it fails with "the provider does not accept the key". (EX-11)
- AC-12: Given the owner rotates a secret later, When Setup re-runs the check, Then it says whether the new one works. (EX-12)
- AC-13: Given the owner asks to let the agent send without asking, When Setup responds, Then it refuses and changes nothing. (EX-13)
- AC-14: Given a step would need a setting that lets the agent send without an approved draft, When Setup reaches that step, Then it does not run the step and tells the owner why. (EX-14)
- AC-15: Given Setup is complete, When the status output is read, Then the secrets do not appear in the clear. (EX-15)

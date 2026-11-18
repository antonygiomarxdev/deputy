# FRD-03: Credentials and safety

Status: draft · Slice: Setup · Part of [Setup PRD](../PRD.md)

## Summary

The owner's passwords, codes and payment details never pass through the agent. The two secrets Deputy needs are entered by the owner in a place the agent does not read, and never shown back in full. Setup never loosens the rule that nothing goes out without an approved draft. See [../PRD.md](../PRD.md).

## Requirements covered

R-SETUP-13, R-SETUP-14, R-SETUP-15.

## Behavior

Step 4 is the credentials step: the owner enters the two secrets, and the check says the provider accepts them and Deputy can reach the connected number.

- **FR-SETUP-03-1.** Setup never asks the agent to enter, read or hold the owner's passwords, verification codes or payment details. Setup never asks the owner to type or paste them into the agent conversation. Each instruction that involves them says where the owner types them: the provider's or the phone's own screen.
- **FR-SETUP-03-2.** Deputy needs the provider's access key. For live delivery (optional, FRD-02) it also needs the secret that proves incoming messages come from the provider. Setup tells the owner where to get each on the provider's pages and where to put it: a local place on the owner's machine. The agent does not read it because the locked-down agent profile denies that path. With any other agent, the owner must restrict that path themselves. This is the known limit: an agent with file tools of its own could read it, and Setup says so. Deputy offers a plain way to open that place and shows which lines the owner must fill, with no secret in the view.
- **FR-SETUP-03-3.** If the owner pastes a secret, password or code into the agent conversation, the agent tells the owner not to do that, and Setup tells the owner to replace that secret on the provider's page. The pasted value is not used: nothing in Setup reads a secret from the conversation. Spotting the paste is the agent's behavior, taught by the setup guide text. Deputy cannot detect it.
- **FR-SETUP-03-4.** The secrets are stored on the owner's machine only. Setup shows them back only in part (the last four characters for long secrets, nothing but present or absent for short ones) and says whether each is present.
- **FR-SETUP-03-5.** Secrets are never written to chat logs, status output, or any document the owner might share, and never sent to a customer.
- **FR-SETUP-03-6.** The check for secrets says whether each is present and accepted by the provider. It says nothing about their value.
- **FR-SETUP-03-7.** Setup does not change any setting of the owner's agent that would let it send without an approved draft. If the owner asks for that (for example "always allow"), Setup refuses and says the approval is the owner's go in the conversation.
- **FR-SETUP-03-8.** If a step would need such a setting, Setup does not run the step and tells the owner why.

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

## Acceptance tests

- Given step 4 is in progress, When the full setup conversation and the files are reviewed, Then they hold no owner password, verification code or payment detail. (FR-SETUP-03-1)
- Given the owner enters the access key in the local place, When the agent asks for the setup status, Then the status says the key is present and shows at most its last four characters. (FR-SETUP-03-2, FR-SETUP-03-4)
- Given the setup guide text, When it is reviewed, Then it tells the agent to refuse pasted secrets and to tell the owner to replace them. (FR-SETUP-03-3)
- Given the locked-down agent profile, When its deny list is read, Then it covers the path of the secrets. (FR-SETUP-03-2)
- Given setup is complete, When logs and status output are searched for the secrets, Then neither appears in the clear. (FR-SETUP-03-4, FR-SETUP-03-5)
- Given the owner asks to let the agent send without asking, When Setup responds, Then it refuses and changes nothing. (FR-SETUP-03-7)
- Given the access key was revoked, When the check runs, Then it fails and says the key is not accepted, without showing the key. (FR-SETUP-03-6)

## Open questions

1. Which exact place is the local place, and what is the simplest way for a non-technical owner to open it on each system? (TP)

# FRD-01: Guided flow

Status: Approved (2026-11-25) · Slice: Setup · Part of [Setup PRD](../PRD.md)
Approval: content noPahJbV_gxJ; rests on ../PRD.md SshZ554utN5k

Deferred (REQ-15, 2026-11-24): the local pilot replaces the guided flow with a Deputy skill (D33). The document stays as written.

## Summary

Setup walks the owner through a fixed list of steps. At every moment the owner sees the current step, how many remain, and who acts. A step passes only when its check passes. Setup can be stopped and resumed, and it times the whole run. See [../PRD.md](../PRD.md).


Last change: 2026-11-24, format 4: a Why section, rules and examples, quality criteria and the n/a references added from the existing text; rows gain "shall"; returned to Draft.

## Why

The slice PRD's requirements R-SETUP-1 to R-SETUP-5 and R-SETUP-20: the owner sees the current step and whose action it is, and a step passes only when its check passes (see the [Setup PRD](../PRD.md)).

## Requirements covered

R-SETUP-1, R-SETUP-2, R-SETUP-3, R-SETUP-4, R-SETUP-5, R-SETUP-20.

## Behavior

The steps, in order: (1) install Deputy into the agent, in test mode, and check the agent sees it; (2) read the costs and the sync warning; (3) connect the number and accept the sync; (4) enter the credentials and check them; (5) fill in the business profile and catalog; (6) send and receive a test message. Test mode skips steps 2, 3 and 4 and stays on the development provider (see FRD-04).
Order and bootstrap: step 1 puts Deputy in the agent in test mode, so Deputy's setup status and checks exist from the first step. The written setup guide that the agent reads leads the owner through step 1 itself. How the owner gets the Deputy package onto their machine is outside Setup (PRD open question 6).

| ID | Pattern | Requirement |
|---|---|---|
| FR-SETUP-01-1 | always | Deputy shall offer the agent a way to show the setup status. It shall list every step with its state (done, current, to do), the current step's name, how many steps remain, and what the owner must do now. |
| FR-SETUP-01-2 | always | Every instruction shall be marked "You do this" or "Your agent can do this". A step the owner must do themselves shall never be marked as the agent's. |
| FR-SETUP-01-3 | always | Each step shall have a check. The agent can run it on request. The next step shall start only when the check passes. |
| FR-SETUP-01-4 | always | A failed check shall say in plain words what is wrong and what to do. It shall never show an internal error as the only message. |
| FR-SETUP-01-5 | always | The check for step 1 shall pass only when the agent can list Deputy's tools and the list holds the tools the later steps need. A claim by the agent that it is connected shall not count. If Deputy is absent from the list, the check shall fail and say Deputy is not installed in the agent. |
| FR-SETUP-01-6 | always | The owner shall be able to stop at any point. Deputy shall keep which steps passed. |
| FR-SETUP-01-7 | WHEN | When the owner resumes, Deputy shall re-run the checks of all finished steps in order. It shall continue at the first step that no longer passes and shall not repeat steps that still pass. What each check is on resume: step 1 is a live listing of Deputy's tools; step 2 (costs shown, sync warning confirmed) uses the stored result; step 3 (number connected) and step 4 (credentials accepted, Deputy can reach the number) are live probes of the provider; step 5 uses the stored owner confirmation of the profile and catalog; step 6 (round trip) uses the stored result and is never re-run on resume. |
| FR-SETUP-01-8 | always | Instructions shall use plain language: no unexplained terms, one action per instruction. Where the owner must click or tap, the instruction shall use the words shown on the provider's or the phone's screen. |
| FR-SETUP-01-9 | always | Setup shall record the time of the first instruction and the time each step started and passed. Provider wait shall start when the owner tells Setup they asked the provider to connect the number, and shall end when the provider reports the number connected and its history sync done. It shall also cover the wait for the provider to deliver the test message. It shall be recorded apart from the owner's and the agent's time. The time of the first instruction is the time Deputy first shows the setup status. |
| FR-SETUP-01-10 | WHEN | When the round-trip test passes, Setup shall show the total from the first instruction to that moment, and the provider wait separately. The optional live-delivery step (FRD-02) shall be timed apart and shall not be part of that total. |
| FR-SETUP-01-11 | always | Step 1 shall start Deputy on the development provider and store the mode (test). Step 3 shall change the provider setting that Intake reads to the real provider (see Intake FR-INTAKE-01-1). Changing it later is the switch in FRD-04. |

Example conversation:
> Agent: Step 2 of 6. 4 steps remain after this one. This one is yours: read the costs below, then tell me you have read them.

## Rules and examples

The rules are the behavior rows above, one rule per row. The examples are written from each rule's text and from the existing acceptance tests and edge cases of this document. Every rule has a positive example and a negative or boundary example.

| Rule | Text | Covers |
|---|---|---|
| RULE-1 | the setup status shows every step and the owner's next action | FR-SETUP-01-1 |
| RULE-2 | each instruction says who acts | FR-SETUP-01-2 |
| RULE-3 | the next step starts only when the current check passes | FR-SETUP-01-3 |
| RULE-4 | a failed check says what is wrong and what to do | FR-SETUP-01-4 |
| RULE-5 | step 1 passes only on a live listing of Deputy's tools | FR-SETUP-01-5 |
| RULE-6 | Setup keeps which steps passed | FR-SETUP-01-6 |
| RULE-7 | resume re-checks the finished steps in order | FR-SETUP-01-7 |
| RULE-8 | instructions use plain language and the screen's words | FR-SETUP-01-8 |
| RULE-9 | provider wait is timed apart from the owner's and the agent's time | FR-SETUP-01-9 |
| RULE-10 | the round-trip total is shown with the provider wait apart | FR-SETUP-01-10 |
| RULE-11 | step 1 starts test mode and step 3 switches the provider | FR-SETUP-01-11 |

| ID | Rule | Kind | Given | When | Then |
|---|---|---|---|---|---|
| EX-1 | RULE-1 | positive | A new owner | the agent asks for the setup status | it sees six steps, the current one named, the remaining count, and whose action it is |
| EX-2 | RULE-1 | boundary | Deputy is installed and nothing else is done | the agent asks for the setup status | it shows step 1 as current in test mode |
| EX-3 | RULE-2 | positive | Step 2 is the owner's to do | the agent shows the step | it is marked "You do this" |
| EX-4 | RULE-2 | negative | A step the owner must do themselves | the step is shown | it is never marked "Your agent can do this" |
| EX-5 | RULE-3 | positive | The check of step 3 fails | the owner asks to go on | step 4 does not start |
| EX-6 | RULE-3 | negative | The agent says step 3 is done but its check fails | the owner asks to go on | the check wins and step 4 does not start |
| EX-7 | RULE-4 | positive | The check of step 3 fails | the owner asks to go on | the message says what is wrong and what to do |
| EX-8 | RULE-4 | boundary | The provider is down | a check runs | Setup says so, keeps the step as not passed, and tells the owner to retry later |
| EX-9 | RULE-5 | positive | Deputy is not in the agent's tool list | the step 1 check runs | it fails and says Deputy is not installed in the agent |
| EX-10 | RULE-5 | negative | The agent says Deputy is connected, but Deputy is not in its tool list | the step 1 check runs | the claim does not count and the check fails |
| EX-11 | RULE-6 | positive | The agent restarts mid-step | the agent asks for the setup status | it shows the state Setup kept, not the conversation |
| EX-12 | RULE-3 | boundary | The owner asks to skip a step | Setup answers | it refuses and explains what that step protects |
| EX-13 | RULE-7 | positive | The owner stopped after step 3 | the owner resumes | steps 1-3 are re-checked first, and Setup continues at step 4 if they still pass |
| EX-14 | RULE-7 | negative | The provider disconnected the number since step 3 passed | the owner resumes | Setup returns to step 3 and says why |
| EX-15 | RULE-7 | boundary | Steps 1-5 passed and the number was disconnected | the owner resumes | step 1 is a live listing, step 2 uses its stored result, step 3 is probed live, and step 6 is not re-run |
| EX-16 | RULE-8 | positive | An instruction tells the owner to tap a button | the instruction is written | it uses the words shown on the phone's screen |
| EX-17 | RULE-8 | boundary | An instruction needs no click or tap | the instruction is written | the screen-words rule does not apply |
| EX-18 | RULE-9 | positive | The owner stopped for days | the total is shown | the first-instruction time is kept, and the working time and the calendar time are shown separately |
| EX-19 | RULE-9 | boundary | On a test clock, the owner says they asked the provider to connect and the provider reports connected 6 minutes later | the provider wait is computed | the provider wait is 6 minutes |
| EX-20 | RULE-10 | positive | A run where the provider took 6 minutes to confirm the number, and the test passes | the summary is shown | it shows the total time and the 6 minutes of provider wait apart |
| EX-21 | RULE-10 | negative | The optional live-delivery step is timed | the round-trip total is shown | the live-delivery time is not part of the total |
| EX-22 | RULE-11 | positive | A new run and step 1 passes | the provider setting Intake reads is checked | it is the development provider |
| EX-23 | RULE-11 | negative | Step 3 has not passed | the provider setting Intake reads is checked | it is still the development provider |
| EX-24 | RULE-6 | negative | The agent says a step is done but its check fails | Deputy keeps which steps passed | the check wins, and the step is not kept as passed |

## Decision table

n/a: the rules have no combination of conditions that changes the outcome, so no decision table is needed.

## States

n/a: the states (done, current, to do) are listed in FR-SETUP-01-1, and the transitions are the checks of FR-SETUP-01-3 and FR-SETUP-01-7, so no separate table is needed.

## Invariants

n/a: docs/INVARIANTS.md holds no row that names this FRD's rules yet.

## Quality criteria

| ID | Characteristic (ISO/IEC 25010) | Criterion |
|---|---|---|
| QC-1 | Functional suitability | Every FR-SETUP-01 row and every EX row is cited by at least one test; `check.ts trace` reports no uncited id. |
| QC-2 | Performance efficiency | n/a: the existing text states no timing target for the checks. |
| QC-3 | Compatibility | n/a: the existing text states no platform target for this FRD. |
| QC-4 | Interaction capability | n/a: the existing text states no interaction target beyond the instruction rules in FR-SETUP-01-8. |
| QC-5 | Reliability | A step that passed earlier and fails on resume sends the owner back to it (FR-SETUP-01-7): the test disconnects the number after step 3 and finds Setup returns to step 3. |
| QC-6 | Security | n/a: secrets are handled in FRD-03, not in this FRD. |
| QC-7 | Maintainability | n/a: the existing text states no maintainability target beyond the repository rules. |
| QC-8 | Flexibility | n/a: the existing text states no change scenario for this FRD; the later switch is FRD-04. |
| QC-9 | Safety | A step the agent reports as done does not pass unless its check passes (FR-SETUP-01-3): the test has the agent claim a step done and finds the next step not started. |

## Cross-cutting

n/a: docs/CROSS-CUTTING.md has no filled row for Setup; the cross-cutting rules live in docs/tp/TP.md.

## Edge cases

- A check cannot run because the provider is down: Setup says so, keeps the step as not passed, and tells the owner to retry later. It does not skip the step.
- The owner stops for days: on resume the first-instruction time is kept, and the total shows the working time and the calendar time separately.
- A step passed earlier fails on resume (for example the provider disconnected the number): Setup goes back to that step and says why. Later steps are re-checked after it passes.
- The owner asks to skip a step: Setup refuses and explains what that step protects. Test mode is the only way to skip the provider steps.
- The agent says a step is done but the check fails: the check wins.
- The agent restarts mid-step: Setup shows the state from what it kept, not from the conversation.

## Information

- Step list with, per step: name, state, time started, time passed, provider wait time.
- Time of the first instruction.
- Mode (real provider or test mode).
- Last check result per step, with the plain-words reason when it failed.

## Open questions

1. Which languages must the guidance support at launch, Spanish and English? (PRD open question 5)
2. Should Setup offer a "run a check now" command for later use outside the first run? (PRD open question 4)
3. How does the owner get the Deputy package onto their machine before step 1: part of the guide or before Setup? (PRD open question 6)

## Acceptance criteria

Generated from the examples above, one per EX row:

- AC-1: Given a new owner, When the agent asks for the setup status, Then it sees six steps, the current one named, the remaining count, and whose action it is. (EX-1)
- AC-2: Given Deputy is installed and nothing else is done, When the agent asks for the setup status, Then it shows step 1 as current in test mode. (EX-2)
- AC-3: Given step 2 is the owner's to do, When the agent shows the step, Then it is marked "You do this". (EX-3)
- AC-4: Given a step the owner must do themselves, When the step is shown, Then it is never marked "Your agent can do this". (EX-4)
- AC-5: Given the check of step 3 fails, When the owner asks to go on, Then step 4 does not start. (EX-5)
- AC-6: Given the agent says step 3 is done but its check fails, When the owner asks to go on, Then the check wins and step 4 does not start. (EX-6)
- AC-7: Given the check of step 3 fails, When the owner asks to go on, Then the message says what is wrong and what to do. (EX-7)
- AC-8: Given the provider is down, When a check runs, Then Setup says so, keeps the step as not passed, and tells the owner to retry later. (EX-8)
- AC-9: Given Deputy is not in the agent's tool list, When the step 1 check runs, Then it fails and says Deputy is not installed in the agent. (EX-9)
- AC-10: Given the agent says Deputy is connected, but Deputy is not in its tool list, When the step 1 check runs, Then the claim does not count and the check fails. (EX-10)
- AC-11: Given the agent restarts mid-step, When the agent asks for the setup status, Then it shows the state Setup kept, not the conversation. (EX-11)
- AC-12: Given the owner asks to skip a step, When Setup answers, Then it refuses and explains what that step protects. (EX-12)
- AC-13: Given the owner stopped after step 3, When the owner resumes, Then steps 1-3 are re-checked first, and Setup continues at step 4 if they still pass. (EX-13)
- AC-14: Given the provider disconnected the number since step 3 passed, When the owner resumes, Then Setup returns to step 3 and says why. (EX-14)
- AC-15: Given steps 1-5 passed and the number was disconnected, When the owner resumes, Then step 1 is a live listing, step 2 uses its stored result, step 3 is probed live, and step 6 is not re-run. (EX-15)
- AC-16: Given an instruction tells the owner to tap a button, When the instruction is written, Then it uses the words shown on the phone's screen. (EX-16)
- AC-17: Given an instruction needs no click or tap, When the instruction is written, Then the screen-words rule does not apply. (EX-17)
- AC-18: Given the owner stopped for days, When the total is shown, Then the first-instruction time is kept, and the working time and the calendar time are shown separately. (EX-18)
- AC-19: Given on a test clock, the owner says they asked the provider to connect and the provider reports connected 6 minutes later, When the provider wait is computed, Then the provider wait is 6 minutes. (EX-19)
- AC-20: Given a run where the provider took 6 minutes to confirm the number, and the test passes, When the summary is shown, Then it shows the total time and the 6 minutes of provider wait apart. (EX-20)
- AC-21: Given the optional live-delivery step is timed, When the round-trip total is shown, Then the live-delivery time is not part of the total. (EX-21)
- AC-22: Given a new run and step 1 passes, When the provider setting Intake reads is checked, Then it is the development provider. (EX-22)
- AC-23: Given step 3 has not passed, When the provider setting Intake reads is checked, Then it is still the development provider. (EX-23)
- AC-24: Given the agent says a step is done but its check fails, When Deputy keeps which steps passed, Then the check wins, and the step is not kept as passed. (EX-24)

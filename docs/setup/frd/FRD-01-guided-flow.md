# FRD-01: Guided flow

Status: Approved (2026-11-18) · Slice: Setup · Part of [Setup PRD](../PRD.md)

## Summary

Setup walks the owner through a fixed list of steps. At every moment the owner sees the current step, how many remain, and who acts. A step passes only when its check passes. Setup can be stopped and resumed, and it times the whole run. See [../PRD.md](../PRD.md).

## Requirements covered

R-SETUP-1, R-SETUP-2, R-SETUP-3, R-SETUP-4, R-SETUP-5, R-SETUP-20.

## Behavior

The steps, in order: (1) install Deputy into the agent, in test mode, and check the agent sees it; (2) read the costs and the sync warning; (3) connect the number and accept the sync; (4) enter the credentials and check them; (5) fill in the business profile and catalog; (6) send and receive a test message. Test mode skips steps 2, 3 and 4 and stays on the development provider (see FRD-04).

Order and bootstrap: step 1 puts Deputy in the agent in test mode, so Deputy's setup status and checks exist from the first step. The written setup guide that the agent reads leads the owner through step 1 itself. How the owner gets the Deputy package onto their machine is outside Setup (PRD open question 6).

| ID | Pattern | Requirement |
|---|---|---|
| FR-SETUP-01-1 | always | Deputy offers the agent a way to show the setup status. It lists every step with its state (done, current, to do), the current step's name, how many steps remain, and what the owner must do now. |
| FR-SETUP-01-2 | always | Every instruction is marked "You do this" or "Your agent can do this". A step the owner must do themselves is never marked as the agent's. |
| FR-SETUP-01-3 | always | Each step has a check. The agent can run it on request. The next step starts only when the check passes. |
| FR-SETUP-01-4 | always | A failed check says in plain words what is wrong and what to do. It never shows an internal error as the only message. |
| FR-SETUP-01-5 | always | The check for step 1 passes only when the agent can list Deputy's tools and the list holds the tools the later steps need. A claim by the agent that it is connected does not count. If Deputy is absent from the list, the check fails and says Deputy is not installed in the agent. |
| FR-SETUP-01-6 | always | The owner can stop at any point. Deputy keeps which steps passed. |
| FR-SETUP-01-7 | always | On resume, Deputy re-runs the checks of all finished steps in order. It continues at the first step that no longer passes. It does not repeat steps that still pass. What each check is on resume: step 1 is a live listing of Deputy's tools; step 2 (costs shown, sync warning confirmed) uses the stored result; step 3 (number connected) and step 4 (credentials accepted, Deputy can reach the number) are live probes of the provider; step 5 uses the stored owner confirmation of the profile and catalog; step 6 (round trip) uses the stored result and is never re-run on resume. |
| FR-SETUP-01-8 | always | Instructions use plain language: no unexplained terms, one action per instruction. Where the owner must click or tap, the instruction uses the words shown on the provider's or the phone's screen. |
| FR-SETUP-01-9 | always | Setup records the time of the first instruction and the time each step started and passed. Provider wait starts when the owner tells Setup they asked the provider to connect the number, and ends when the provider reports the number connected and its history sync done. It also covers the wait for the provider to deliver the test message. It is recorded apart from the owner's and the agent's time. The time of the first instruction is the time Deputy first shows the setup status. |
| FR-SETUP-01-10 | WHEN | When the round-trip test passes, Setup shows the total from the first instruction to that moment, and the provider wait separately. The optional live-delivery step (FRD-02) is timed apart and is not part of that total. |
| FR-SETUP-01-11 | always | Step 1 starts Deputy on the development provider and stores the mode (test). Step 3 changes the provider setting that Intake reads to the real provider (see Intake FR-INTAKE-01-1). Changing it later is the switch in FRD-04. |

Example conversation:

> Agent: Step 2 of 6. 4 steps remain after this one. This one is yours: read the costs below, then tell me you have read them.

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

## Acceptance tests

- Given a new owner, When the agent asks for the setup status, Then it sees six steps, the current one named, the remaining count, and whose action it is. (FR-SETUP-01-1, FR-SETUP-01-2)
- Given the check of step 3 fails, When the owner asks to go on, Then step 4 does not start and the message says what is wrong and what to do. (FR-SETUP-01-3, FR-SETUP-01-4)
- Given Deputy is not in the agent's tool list, When the step 1 check runs, Then it fails and says Deputy is not installed in the agent. (FR-SETUP-01-5)
- Given the owner stopped after step 3, When they resume, Then steps 1-3 are re-checked first, and Setup continues at step 4 if they still pass. (FR-SETUP-01-6, FR-SETUP-01-7)
- Given the provider disconnected the number since step 3 passed, When the owner resumes, Then Setup returns to step 3 and says why. (FR-SETUP-01-7)
- Given Deputy is installed and nothing else is done, When the agent asks for the setup status, Then it works and shows step 1 as current in test mode. (FR-SETUP-01-1, FR-SETUP-01-11)
- Given a test clock, When the owner says they asked the provider to connect and the provider reports connected 6 minutes later, Then the provider wait is 6 minutes. (FR-SETUP-01-9)
- Given steps 1-5 passed and the number was disconnected, When the owner resumes, Then step 1 is a live listing, step 2 uses its stored result, step 3 is probed live, and step 6 is not re-run. (FR-SETUP-01-7)
- Given a new run, When step 1 passes, Then the provider setting Intake reads is the development provider, and it changes to the real provider only when step 3 passes. (FR-SETUP-01-11)
- Given a run where the provider took 6 minutes to confirm the number, When the test passes, Then the summary shows the total time and the 6 minutes of provider wait apart. (FR-SETUP-01-9, FR-SETUP-01-10)

## Open questions

1. Which languages must the guidance support at launch, Spanish and English? (PRD open question 5)
2. Should Setup offer a "run a check now" command for later use outside the first run? (PRD open question 4)
3. How does the owner get the Deputy package onto their machine before step 1: part of the guide or before Setup? (PRD open question 6)

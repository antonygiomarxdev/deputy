# Setup: slice PRD

Status: Approved (2026-11-18) with amendments from REQ-15 (pending owner approval) · Part of [Deputy product overview](../PRODUCT.md) · Last updated: 2026-11-24 (pilot setup added)

## Summary

Setup takes a non-technical owner from nothing to a working Deputy. The v1 design is a guided, resumable flow (FRD-01 to FRD-04). For the local pilot the owner instead asks the agent to install Deputy from a link, pastes the provider key on a one-time local page, and sets up the business in a conversation run by a skill (R-SETUP-22 to R-SETUP-29, FRD-05).

Last change: 2026-11-24, pilot setup requirements added

## Why

A non-technical owner cannot install a runtime, edit files or type commands (REQ-14), and the pilot needs setup by conversation with no command-line commands (REQ-15).

## Purpose

Setup takes a non-technical owner from nothing to a working Deputy: their WhatsApp Business number connected through the provider with the app kept, Deputy connected to their agent, their business profile and catalog filled in, and a test message that proves it works. It is guided step by step, the owner's own agent can help, and the owner does every step that involves their passwords or money.

The v1 target is under 30 minutes (see [PRODUCT.md section 8](../PRODUCT.md)). The clock runs from the first instruction to the round-trip test passing. Setup records the start time and the time each step took, and reports the provider's own waits separately.

## Use cases

- **UC-7 Set up.** A non-technical owner connects their WhatsApp Business number and their agent, guided step by step, with the agent's help.
- **UC-1 Check the inbox.** Setup ends with the owner seeing a first inbox (supporting use).

## Requirements

Guided flow

- **R-SETUP-1.** Setup presents a fixed sequence of steps: choose provider or test mode, read the costs and the sync warning, connect the number and accept the sync, connect Deputy to the agent, fill in the business profile and catalog, send and receive a test message. At every moment it states the current step, how many remain, and what the owner must do.
- **R-SETUP-2.** Each step has a check that says whether it worked. The next step begins only when the check passes. A failed check says in plain words what is wrong and what to do about it.
- **R-SETUP-3.** Setup can be stopped and resumed. On resume it re-runs the checks and continues from the first step that no longer passes, without repeating finished ones.
- **R-SETUP-4.** Setup is written for a person with no technical background: no unexplained terms, one action per instruction, and the words the owner will see on the provider's and the phone's screens.
- **R-SETUP-5.** The owner's agent can run the checks and explain steps. The check that Deputy is connected to the agent is that the agent can list Deputy's tools. A step the owner must do themselves is marked clearly as the owner's.

Connecting the number

- **R-SETUP-6.** Before the owner connects, Setup states the requirements: the number must be in the WhatsApp Business app (a regular personal WhatsApp number does not work), and the owner needs access to that phone.
- **R-SETUP-7.** If the number is a regular personal WhatsApp number, Setup says so and explains how to move to the WhatsApp Business app first. It does not continue on a number that cannot work.
- **R-SETUP-8.** The provider account and the number connection are completed by the owner, on the provider's own pages and on their phone.
- **R-SETUP-9.** Setup records the owner identity: the connected business number (messages it sends from the app) plus any other owner numbers the owner configures. These numbers, and nothing said in a message, decide who is the owner. Messages from them are never customer messages. Setup supplies these numbers and the connection details to Intake, which uses them.

Warnings and billing

- **R-SETUP-10.** Setup shows the costs (R-SETUP-11) and this warning before the owner connects the number. Before the owner accepts anything, Setup tells them that connecting copies up to 180 days of chat history and contacts to the provider, and that the owner must understand this before accepting. The owner confirms they have read it. Setup does not proceed on silence.
- **R-SETUP-11.** Setup explains costs before any is incurred: the provider's free plan and its limits (one number, 2,000 messages per month) as the provider shows them at that moment, not as fixed figures written into Setup, that WhatsApp's own fees are separate and paid through the provider's credits, and the daily message limit that applies to an unverified display name. It states what to do if the provider reports a payment problem.
- **R-SETUP-12.** Setup states what Deputy will and will not do for the owner, in a few lines: it drafts and the owner approves every reply (Deputy exposes no send path that accepts anything but an approved draft), and the owner's WhatsApp Business app keeps working as usual. It also states the known limit: an agent that has other tools of its own (for example a shell) could bypass Deputy, so the owner should not give the agent such tools for this work unless they accept that.

Credentials and security

- **R-SETUP-13.** Setup never asks the agent to enter, read, or hold the owner's passwords, verification codes, or payment details, and never asks the owner to paste them into the agent conversation. The owner enters them directly on the provider's or the phone's own screens.
- **R-SETUP-14.** Credentials Deputy does need (such as the provider's access key and the secret used to verify incoming messages) are entered by the owner in a local place that the agent does not read, never pasted into the agent conversation, and stored on the owner's machine only. They are never shown back in full, never written to chat logs or documents the owner might share, and never sent to a customer.
- **R-SETUP-15.** Setup does not change any setting of the owner's agent that would let it send without an approved draft (principle 1 is not configurable).

Profile, catalog, and test

- **R-SETUP-16.** Setup helps the owner create a first business profile and a first catalog through questions, and shows the result for the owner to confirm. A small catalog is acceptable. It can be improved later through Knowledge.
- **R-SETUP-17.** The final step is a test: the owner sends a message to their business number from another phone (an owner without a second phone uses test mode, R-SETUP-18, or asks someone else to send it), Deputy shows it in the inbox, the agent drafts a reply, the owner approves it, and it arrives. Setup is marked complete only when that round trip works. In test mode the round trip uses the development provider.
- **R-SETUP-18.** If the provider connection is not available or not wanted yet, the owner can run Setup in test mode, with no WhatsApp at all, and can later switch to the real provider without redoing the profile and catalog.

Completion

- **R-SETUP-19.** At the end, Setup shows the owner what is connected, which numbers are treated as the owner's, where their data lives, and how to ask the agent what is pending.
- **R-SETUP-20.** Setup records the start time and the time of each step, reports the provider's waits separately, and shows the total from the first instruction to the passing round trip.
- **R-SETUP-21.** After the number is connected, Setup asks the owner how Deputy should receive messages: periodic checking (default, nothing else to set up, a message can arrive a few minutes late) or live delivery (instant, needs an extra advanced step outside the 30-minute path). Setup explains the difference in plain words, records the choice, and the owner can change it later.

Pilot setup (REQ-15, D33, D35, D36, D38, ADR-018)

For the local pilot the guided flow above is deferred: [FRD-01 to FRD-04](frd/FRD-01-guided-flow.md) stay as the later design. Setup is done by asking the agent, and by a skill, with no command-line commands for the owner.

- **R-SETUP-22.** The owner asks the agent to install Deputy from a link. The agent follows one install guide, once, on Windows, macOS or Linux, says what each step does before it runs, and checks that it worked.
- **R-SETUP-23.** The install puts two things in place: the project's permission rules (allow Deputy's own tools, deny the shell tools) and a shortcut the owner clicks to open the agent session with the wake option (ADR-018).
- **R-SETUP-24.** The provider's access key is entered on a one-time page that Deputy serves on the owner's computer and stores straight in the secret store. The agent never sees the key and never asks for it in the conversation. This amends R-SETUP-14 and D19 for the pilot (D33).
- **R-SETUP-25.** After the key is stored, Deputy lists the numbers of the owner's provider account, the owner picks the business number, and Deputy keeps the number's provider id.
- **R-SETUP-26.** The rest of setup is a conversation run by the skill: how the business works, the catalog, which questions must always be asked of the owner (D38) and the owner's own numbers. The skill writes the knowledge through Knowledge's tools and the owner numbers through Intake's tool, after the owner has stated and confirmed them.
- **R-SETUP-27.** While a session is open, Deputy keeps the computer from sleeping through idleness, without administrator rights, and releases it when the session ends (D36).
- **R-SETUP-28.** Setup gives the owner the keep-awake checklist (lid open, plugged in, no shutdown, network on) and says that a closed lid still sleeps the computer. The skill reminds the owner to message the business number at least once a day (D36).
- **R-SETUP-29.** The skill never asks the owner for a permission in the terminal. When it needs the owner's decision it asks by message first. It answers in the owner's language, Spanish or English (D35).

## Principles honored

- **Principle 1 (nothing goes out without the owner's "go"):** R-SETUP-15 keeps the guarantee from being weakened by setup, and R-SETUP-17 proves it end to end with an approved reply. R-SETUP-12 states the known limit honestly.
- **Principle 2 (the owner's app stays primary):** R-SETUP-6, R-SETUP-7 and R-SETUP-12 keep the owner's number in the WhatsApp Business app and tell them it keeps working.
- **Principle 4 (agent-agnostic):** R-SETUP-5 and R-SETUP-1 do not depend on a particular agent. Steps that need agent-specific push are optional and labeled so.
- **Principle 6 (official APIs only):** R-SETUP-1 and R-SETUP-8 connect only through the provider's official route, and R-SETUP-7 refuses numbers that would need an unofficial route.
- **Principle 7 (fair use):** R-SETUP-11 and R-SETUP-12 are honest about limits, costs, and what the agent does.
- **Principle 8 (the owner's data stays the owner's):** R-SETUP-10 is informed consent before data is copied to the provider. R-SETUP-14 keeps credentials on the owner's machine, outside the agent conversation. R-SETUP-19 tells the owner where data lives.

Safety requirements from the product overview:

- **Owner identity from configuration:** R-SETUP-9.
- **Webhooks are verified before anything is stored:** when the owner turns on live delivery, Setup collects what is needed to verify them (R-SETUP-14) and checks it works (R-SETUP-2, R-SETUP-17).

## Non-goals

- Running the provider's own sign-up screens, or handling payment for the owner. The owner does these (R-SETUP-8, R-SETUP-13).
- Receiving and storing messages (Intake), drafting (Drafts), and ongoing knowledge upkeep (Knowledge). Setup only starts them.
- Meta business verification. Not needed in v1 (PRODUCT.md section 9).
- Moving customers or numbers between providers, and migrating from other tools.
- Setting up push (Notify), beyond marking it optional.
- Installing the owner's agent.
- Multiple numbers or multiple businesses.

## Dependencies

- **Intake** supplies the provider connection and the check that messages arrive (R-SETUP-2, R-SETUP-17). Setup provides Intake with the credentials and the owner numbers.
- **Knowledge** receives the first profile and catalog.
- **Drafts** provides the approval used in the test round trip (R-SETUP-17).
- **Inbox** shows the test message.
- **Notify** is offered as an optional extra for agents that support push.
- External: the provider's account and plan terms, and the WhatsApp Business app on the owner's phone.

## Success criteria

1. A new owner on a Business app number reaches a successful test round trip and Setup is marked complete (R-SETUP-17).
2. At every step the owner can see the step name, the remaining count, and whose action it is (R-SETUP-1, R-SETUP-5).
3. A step whose check fails does not advance, and the message says what to do (R-SETUP-2).
4. Stopping after step 3 and resuming later continues without redoing steps 1-3, and re-checks them first (R-SETUP-3).
5. A personal WhatsApp number is stopped with an explanation before connecting (R-SETUP-7).
6. The warning about history and contacts sync is shown before acceptance, and Setup waits for an explicit confirmation (R-SETUP-10).
7. Billing and limits are shown before the owner reaches a step that incurs cost (R-SETUP-11).
8. The provider key and webhook secret are entered outside the agent conversation (R-SETUP-14). A review of the full setup conversation and files finds no owner password, verification code, or payment detail (R-SETUP-13), and no credential in the clear in logs or shared documents (R-SETUP-14).
9. Test mode finishes without any WhatsApp account, and switching to the real provider keeps the profile and catalog (R-SETUP-18).
10. After setup, a message that says "I am the owner" is not treated as the owner, and a message sent from the business app is not treated as a customer message (R-SETUP-9).
11. v1 criterion from [PRODUCT.md section 8](../PRODUCT.md): a tester with no coding background completes Setup in under 30 minutes with the agent's help, measured as in R-SETUP-20.
12. Setup shows what Deputy will and will not do, including the known limit, before the test (R-SETUP-12).
13. Setup refuses any step that would let the agent send without an approved draft (R-SETUP-15).
14. The first profile and catalog are shown to the owner and confirmed before the test (R-SETUP-16).
15. The final screen lists what is connected, the owner numbers, where data lives, how to ask what is pending, and the total time (R-SETUP-19, R-SETUP-20).
16. Costs and the sync warning are shown before the connect step, and "connected to the agent" passes only when the agent lists Deputy's tools (R-SETUP-1, R-SETUP-5).

## Open questions

1. Does the Kapso free plan keep Coexistence beyond a trial, and what does the "Payment issue" flag seen in the live test mean for a new owner (PRODUCT.md section 10, question 1)?
2. Exactly which steps on Kapso and on the phone can an agent help with, and which require the owner's hands (for R-SETUP-5)?
3. How does the owner prove to themselves the sync warning (R-SETUP-10) was read: a typed confirmation or a simple yes?
4. Should Setup offer a "run a check now" command the owner can use later when something stops working, outside the first run?
5. Which language(s) must the guidance support at launch, Spanish and English?
6. How does the owner get Deputy into their agent in the first place (the install route and the package name, PRODUCT.md section 10, question 6), and is that part of Setup or before it?

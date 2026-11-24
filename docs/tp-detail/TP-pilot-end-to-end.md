# TP: the local pilot end to end

Part of [TP.md](../tp/TP.md). Added 2026-11-24 for the local pilot (REQ-15, D31 to D38). It draws how the pieces already specified work together; it decides nothing new.

Sources: Intake FRD-05, TP-05 and SPEC-05-x; Setup FRD-05 and SPEC-05-x; Knowledge FRD-04 and SPEC-04-x; ADR-018; Drafts pilot specs SPEC-05 to SPEC-13 and Drafts ADR-013 (PR #202, branch docs/drafts-pilot, not merged when this was written).

Spec ids in the drawings use one letter for the slice: I = Intake, D = Drafts, K = Knowledge, S = Setup. `I05-6` is Intake SPEC-05-6; `I03` is Intake SPEC-03 (catch-up); `D07` is Drafts SPEC-07. An arrow with no spec that builds it says GAP, and the GAP list at the end repeats each one.

## 1. Components

What runs where. The owner talks to Claude Code, the session calls Deputy's tools over stdio, and Deputy talks to Kapso. Nothing else leaves the computer.

```mermaid
flowchart LR
  Owner["Owner phone: WhatsApp"]
  Cust["Customer phone: WhatsApp"]
  Kapso["Kapso API: business number"]
  Sess["Claude Code session with the deputy skill: S05-7"]
  MCP["Deputy MCP server over stdio: owner process, lease"]
  KeyPg["Key page, loopback only: S05-2"]
  Awake["Keep-awake child process: S05-6"]
  Sec["OS secret store: provider key"]
  Cfg["config.json: provider, number id: S05-8"]
  Know["Knowledge folder: profile, catalog, memory, always-ask: K04-2"]
  Db[("SQLite deputy.db")]
  Cust --> Kapso
  Owner --> Kapso
  Kapso -->|"catch-up poll: I03"| MCP
  MCP -->|"SendText: I04, D03"| Kapso
  Sess -->|"tools, mcp__deputy__* allowed: ADR-018"| MCP
  MCP -.->|"channel notice: GAP"| Sess
  Owner -->|"types /deputy"| Sess
  MCP --> Db
  MCP --> Know
  MCP --> KeyPg
  KeyPg -->|"key stored: S05-2"| Sec
  MCP --> Cfg
  MCP -->|"started on lease: S05-6"| Awake
```

The slices inside the server, the tables each owns, and how they call each other. A slice imports another only through its `index.ts` (ADR-000).

```mermaid
flowchart TD
  Root["src/main: composition root, one file per job: ADR-013"]
  Intake["Intake: messages, chats, outgoing, owner_numbers, owner_number_log, owner_questions, catchup_status, lease, settings"]
  Drafts["Drafts: drafts, approvals with basis, drafts_log with automatic, pending_goes, draft_counter"]
  Know["Knowledge: files in the config folder, change log"]
  Setup["Setup: key page, number pick, config writer, keep-awake, skill"]
  Shared["Shared kernel: Clock, OwnerLease, signals, text, containsWords"]
  Root --> Intake
  Root --> Drafts
  Root --> Know
  Root --> Setup
  Drafts -->|"SendText, ReadChat, CatchUpChat: D03"| Intake
  Intake -->|"OwnerAnswered signal: I05-12"| Drafts
  Know -->|"message checks: K04-7"| Intake
  Intake --> Shared
  Drafts --> Shared
  Know --> Shared
```

## 2. Sequences

Each message names the tool, the spec and the table. "Session" is Claude Code with the skill.

### (a) Install and setup interview

```mermaid
sequenceDiagram
  participant O as Owner
  participant S as Session
  participant M as Deputy MCP
  participant K as Kapso
  O->>S: asks the agent to install Deputy from a link
  S->>S: INSTALL.md steps, settings allow mcp__deputy__* and deny Bash (S05-1, ADR-018)
  S->>M: open_key_page (S05-4)
  M-->>S: loopback url, never the key (S05-2)
  O->>M: pastes the key on the page, goes to the OS secret store (S05-2)
  S->>M: list_numbers (S05-4)
  M->>K: list the account numbers (S05-3)
  K-->>M: numbers
  S->>M: select_number (S05-4)
  M->>M: writeConfigKey in config.json (S05-8)
  M->>M: adopt the business number, owner_numbers kind business (I05-9)
  S->>O: interview, confirm before saving (S05-5)
  S->>M: save_profile, save_catalog, save_always_ask with owner words (K04-3, K04-5)
  S->>M: set_owner_numbers describe, then confirm (I05-10, I05-11, table owner_numbers and owner_number_log)
  S->>O: tells the owner to write the business number once, opens the window (GAP: no spec for the first message)
```

### (b) Customer message to a knowledge-backed automatic answer

```mermaid
sequenceDiagram
  participant C as Customer
  participant K as Kapso
  participant M as Deputy MCP
  participant S as Session
  participant O as Owner
  C->>K: message
  K->>M: catch-up poll stores it (I02, I03, tables messages and chats)
  S->>M: check_messages (I03)
  S->>M: get_chat with windowClosesAt, list_pending (I05-3)
  S->>M: read_knowledge (K04-5, K04-2)
  S->>S: classes the question, not in always-ask, knowledge backs it
  S->>M: send_answer chatId, text, answerClass, knowledge (D13)
  M->>M: decideAutoSend, send true (D05)
  M->>M: checkFirstSend, window open (D06)
  M->>M: create draft, approveWithoutWords automatic, row in approvals with basis (D09-4, D09-5a, D09-5b)
  M->>M: driveSend, state sending, lease token re-checked (D03, tables drafts and drafts_log)
  M->>K: SendText sendId, chat, text (I04, table outgoing)
  K-->>M: accepted
  M->>M: state sent, log entry automatic (D09-1, D09-2, D09-3a, D09-3b)
  M-->>S: sent
  O-->>S: reads the count with pilot_stats (D13, D08)
```

### (c) Always-ask or unknown: ask the owner, take the answer as the go

```mermaid
sequenceDiagram
  participant C as Customer chat
  participant S as Session
  participant M as Deputy MCP
  participant K as Kapso
  participant O as Owner phone
  S->>M: ask_owner number, questions with chatId and text (I05-8, I05-6)
  M->>M: chat is a stored customer chat, owner window open (I05-6, table messages)
  M->>K: ONE numbered message listing the open questions (I05-6, I04)
  M->>M: record each question with chat_id (I05-4, I05-5, table owner_questions)
  M-->>S: questionIds
  O->>K: answers freely, in one or more messages
  K->>M: catch-up stores them in the control chat (I03, table messages)
  S->>M: get_chat on the control chat (I05-8)
  M-->>S: owner messages and openQuestions with ids
  S->>S: decides which answer belongs to which question
  S->>M: answer_question questionId, text (I05-8, I05-7)
  M->>M: containsWords in an owner message after askedAt, else not_owner_words (I05-13, I05-7)
  M->>M: close the question, publish OwnerAnswered (I05-7, I05-12, table owner_questions)
  M->>M: recordGo into pending_goes (D11, D07, D10-2, table pending_goes)
  S->>M: send_owner_go chatId, text (D13)
  M->>M: takeGo once, inside the customer window, used_at and send_id (D07, D12)
  M->>M: approveWithoutWords owner_go, driveSend (D09-4, D12, D03)
  M->>K: SendText to the customer (I04)
  M-->>S: sent
  S-->>C: the customer reads the reply
```

### (d) The owner's window is closed: ask in the Claude app

```mermaid
sequenceDiagram
  participant S as Session
  participant M as Deputy MCP
  participant O as Owner
  S->>M: ask_owner number, questions (I05-8, I05-6)
  M->>M: owner window closed, 24 h after the owner's latest message (I05-6, table messages)
  M-->>S: refused window_closed, nothing sent, nothing recorded (I05-6)
  S->>O: asks in the Claude app, tells the owner to answer on WhatsApp (I05-8 error text, S05-7 rule)
  O->>M: writes any message to the business number, window reopens (I03, table messages)
  S->>M: ask_owner again (I05-8)
```

### (e) The customer window is closed: no send, tell the owner

```mermaid
sequenceDiagram
  participant S as Session
  participant M as Deputy MCP
  participant O as Owner
  S->>M: send_answer or send_owner_go (D13)
  M->>M: checkFirstSend, latest customer message over 24 h old (D06, table messages)
  M-->>S: refused window_closed, tellOwner (D06, D13)
  S->>O: tells the owner the customer window is closed (D06)
  Note over M: a pending go stays in pending_goes, unused (D07 test 4)
  Note over M: tellOwner on the send_owner_go path: GAP
```

### (f) Crash in the middle of a send

```mermaid
sequenceDiagram
  participant M as Deputy MCP
  participant K as Kapso
  participant S as Session
  M->>M: draft sending, approval and log written in one transaction (D03, tables drafts, approvals, drafts_log)
  M->>K: SendText sendId (I04, table outgoing)
  Note over M: process dies before the result is recorded
  M->>M: restart, lease acquired, first catch-up (I03, ADR-002)
  M->>M: RecoverInterrupted: sending becomes unknown (D03)
  M->>M: ResolveUnknownSends asks FindOutgoing by send id, one match is linked (D03, I04)
  alt match found
    M->>M: draft sent, log entry (D03, D04)
  else no match
    M->>S: draft stays unknown, owner decides (D03)
  end
  Note over M: an owner_go consumed by that send is not restored: GAP
```

### (g) Restart with a pending go

```mermaid
sequenceDiagram
  participant M as Deputy MCP
  participant S as Session
  participant I as Intake
  Note over M: pending_goes row written, process restarts (D10-1, D10-2)
  M->>M: new owner process, lease acquired (ADR-002)
  M->>I: catch-up, then adopt the business number (I03, I05-9)
  S->>M: send_owner_go chatId, text (D13)
  M->>M: takeGo reads the stored go, window still open (D07, D10-2)
  M->>M: approveWithoutWords owner_go and send as in (c) (D12)
  Note over M: an OwnerAnswered published after commit but lost before recordGo is not replayed: GAP
```

### (h) Remember from the control chat

```mermaid
sequenceDiagram
  participant O as Owner phone
  participant M as Deputy MCP
  participant S as Session
  O->>M: control-chat message, for example a rule to keep (I03, I05-1, table messages)
  S->>M: get_chat on the control chat (I05-8)
  M-->>S: the stored message with its id
  S->>M: remember text, source control_chat with message_id (K04-5, K04-4)
  M->>M: ownerControlMessage reads the stored message from Intake (K04-7)
  M->>M: text must be contained in that owner message by containsWords (K04-4, I05-13)
  M->>M: refuse customer text and over-size text (K04-1, K04-4)
  M->>M: append one dated line to memory.md (K04-2)
  M-->>S: remembered
```

### (i) Wake: channel notice, slow loop and catch-up poll

```mermaid
sequenceDiagram
  participant K as Kapso
  participant M as Deputy MCP
  participant S as Session
  loop catch-up scheduler
    M->>K: poll the provider (I03, ADR-005, table catchup_status)
    K-->>M: new messages stored (I02, table messages)
  end
  M-->>S: batched channel notice, counts only (ADR-018, ADR-007, GAP: no spec builds the notice)
  Note over S: the session reads it on its next turn, instant wake is unverified (ADR-018)
  loop /loop every 30 to 60 minutes
    S->>M: check_messages (I03)
    M-->>S: sync status and stored count
  end
  Note over S: the loop recipe and the daily steps in SKILL.md: GAP, S05-7 builds only the headings
  S->>M: list_pending (I05-3)
```

## 3. States

The draft, with the basis of its approval. `waiting` to `sending` is the one send path; the three bases differ only in how the approval was allowed (D09-4, D09-5a).

```mermaid
stateDiagram-v2
  [*] --> waiting: create_draft or send tool
  waiting --> sending: approved, basis owner_words, automatic or owner_go
  waiting --> rejected: owner rejects
  waiting --> replaced: replaced by a new draft
  held --> waiting: owner picks a choice
  sending --> held: catch-up shows the owner answered or the customer wrote again
  sending --> sent: provider accepted
  sending --> failed: provider refused
  sending --> unknown: crash or partial failure
  failed --> sending: retry inside the window
  unknown --> sent: FindOutgoing finds one match
  unknown --> failed: no match after the next catch-up
  sent --> [*]
  rejected --> [*]
  replaced --> [*]
```

The owner question, from Intake FRD-05 and SPEC-05-4 to SPEC-05-7.

```mermaid
stateDiagram-v2
  [*] --> open: ask_owner records the question and sends the numbered message
  open --> answered: answer_question, text contained in a later owner message
  open --> open: answer_question refused, unknown question or not the owner's words
  answered --> [*]
```

The pending go, from Drafts SPEC-07 and SPEC-10-2.

```mermaid
stateDiagram-v2
  [*] --> pending: recordGo on OwnerAnswered
  pending --> pending: takeGo with the customer window closed
  pending --> used: takeGo inside the window, used_at and send_id set
  used --> [*]
```

## 4. Data

The new tables and the columns the pilot adds to existing ones. Existing tables are shown only where the pilot touches them.

```mermaid
erDiagram
  chats ||--o{ messages : holds
  chats ||--o{ owner_questions : "is about"
  owner_numbers ||--o{ owner_number_log : "changes logged"
  chats ||--o{ drafts : "has"
  drafts ||--o{ approvals : "approved by"
  drafts ||--o{ drafts_log : "logged in"
  chats ||--o{ pending_goes : "go for"
  owner_questions ||--o| pending_goes : "answer becomes"
  owner_questions {
    integer number PK
    text owner_chat
    text chat_id "customer chat, I05-4"
    text text
    integer asked_at
    text send_id
    text answer
    integer closed_at
  }
  pending_goes {
    integer id PK
    text question_id
    text chat_id
    text text
    integer answered_at
    integer used_at
    text send_id
  }
  approvals {
    text basis "owner_words, automatic or owner_go, D09-5a"
  }
  drafts_log {
    integer automatic "D09-3a"
  }
```

## 5. GAP list

An arrow in a drawing that no spec builds. Each is stated as found; none is decided here.

1. Channel notice. ADR-018 expects a batched notice through the channel, and Intake SPEC-01 only declares the capability. No spec emits the notice (Notify has no spec in the pilot). The `/loop` fallback does not depend on it.
2. Skill daily loop. Setup SPEC-05-7 builds the headings of SKILL.md and leaves the daily steps (check, classify, `send_answer`, `ask_owner`, `answer_question`, `send_owner_go`) and the `/loop` recipe to "the Drafts pilot specs", and those specs hold no skill text.
3. First owner message. The owner window opens only when the owner writes to the business number (FR-INTAKE-05-7). No spec has the setup interview ask for that first message, so the first `ask_owner` after setup can return `window_closed`.
4. A consumed go. Drafts SPEC-07 `takeGo` marks the go used before the send runs; if the send then fails or the process crashes (diagram f), no spec returns the go or tells the session.
5. A lost signal. `OwnerAnswered` is published in process after the commit (Intake SPEC-05-7); a crash between that commit and Drafts SPEC-11 `recordGo` leaves a closed question with no pending go, and nothing replays it at start (diagram g).
6. Closed window on the go path. Drafts SPEC-06 sets `tellOwner` for `send_answer`; `send_owner_go` with a closed window returns nothing sent, and no spec says it tells the owner (diagram e).

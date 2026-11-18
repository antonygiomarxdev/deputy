# ADR-004: Deputy assigns the groups; the agent only hints which chats are orders

## Status
Proposed

## Context
R-INBOX-4 says every pending chat is in exactly one group and none is omitted, with the precedence needs the owner, orders, easy questions. FR-INBOX-02-6 says the agent judges whether a chat looks like an order, while "easy questions" needs a draft that Drafts reports waiting. The agent writes the final summary text. From TP-02 TD-1.

## Decision
- `GroupAssigner` (domain) assigns each pending chat one group from Drafts' state per chat, whether the waiting message is recorded as an order, and one optional input of the `inbox` tool, `order_chats`.
- Rules in order: a held, failed or unknown draft gives needs the owner; a recorded order is not offered as an order; an order draft waiting or a hint gives orders; a reply draft waiting gives easy questions; the rest gives needs the owner.
- A hint for a chat that is not pending is ignored and reported.

## Alternatives
- Flat list, the agent groups: "exactly one group, never omitted" becomes an instruction no test can check; a failed draft could be shown as easy.
- Keyword detection of orders in Deputy: fails in every language not listed (D20) and makes Deputy read customer text to decide.

## Consequences
- Easier: the guarantees are code with tests, including a property test over random mixes.
- Harder: the agent may call `inbox` twice to pass the hint.
- Watch: customer text can sway the agent's hint; the worst effect is a chat shown under orders instead of needs the owner, and a problem draft outranks the hint.

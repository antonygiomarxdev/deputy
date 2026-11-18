import { z } from "zod";
import { customerText } from "../../../adapters/mcp/customer-text";
import { defineTool, type ToolDefinition, type ToolResult } from "../../../adapters/mcp/tool";
import type { Refusal } from "../../domain/refusals";
import { refusalText } from "../../domain/refusals";
import type { ApproveDraft, ApproveOrderCommand, ChangeDraft, CheckApprovals, CreateDraft, LogEntryView, MessageView, Outcome, ReadDraftLog, RejectDraft } from "../../ports/inbound";

const order = z.record(z.string(), z.unknown());

export function refusalResult(r: Refusal): ToolResult {
  const text = refusalText(r);
  return { text, structured: { ...r, refusalText: text }, isError: true };
}

/** The customer's message the draft answers: its text is customer-written, so it is escaped and labeled. */
export function answeredMessage(m: MessageView): { id: string; sentAt: string; source: string; text: string } {
  return { id: m.id, sentAt: m.sentAt, source: m.source, text: customerText("customer_text", m.text) };
}

async function outcome<T>(run: Promise<Outcome<T>>, ok: (value: T) => ToolResult): Promise<ToolResult> {
  const out = await run;
  return out.ok ? ok(out.value) : refusalResult(out.refusal);
}

type OrderCommandValue = Extract<Awaited<ReturnType<ApproveOrderCommand["run"]>>, { ok: true }>["value"];

function orderCommandResult(r: OrderCommandValue): ToolResult {
  if (!r.approved) return { text: r.pendingDelete, structured: { approved: false, pendingDelete: r.pendingDelete }, isError: false };
  return {
    text: r.result.ok ? r.result.detail : `Orders refused: ${r.result.reason}`,
    structured: { approved: true, logEntryId: r.logEntryId, result: r.result },
    isError: false,
  };
}

export function draftsTools(u: { createDraft: CreateDraft; changeDraft: ChangeDraft; rejectDraft: RejectDraft }): ToolDefinition[] {
  const createDraft = defineTool({
    name: "create_draft",
    description:
      "Write a draft answer for a chat, or an order draft. Nothing is sent: the owner must approve the draft by its number. A reply needs `text`; an order needs `order`.",
    input: {
      kind: z.enum(["reply", "order"]).default("reply"),
      chat: z.string().min(1),
      text: z.string().optional(),
      order: order.optional(),
    },
    async run(a) {
      if (a.kind === "reply" && a.text === undefined) return refusalResult({ code: "empty_text" });
      if (a.kind === "order" && a.order === undefined) {
        return { text: "an order draft needs the order", structured: { code: "order_required", refusalText: "an order draft needs the order" }, isError: true };
      }
      const input =
        a.kind === "reply"
          ? { kind: "reply" as const, chat: a.chat, text: a.text ?? "" }
          : { kind: "order" as const, chat: a.chat, order: a.order ?? {} };
      return outcome(u.createDraft.run(input), (d) => {
        const lines = [
          `draft ${d.number} (${d.kind}) is waiting for the owner's go`,
          ...(d.replaced ? [`it replaced draft ${d.replaced.number} (${d.replaced.state})`] : []),
          ...(d.answers ? [`it answers: ${customerText("customer_text", d.answers.text)}`] : []),
          `text: ${customerText("customer_text", d.text)}`,
        ];
        return {
          text: lines.join("\n"),
          structured: {
            number: d.number,
            kind: d.kind,
            state: d.state,
            text: customerText("customer_text", d.text),
            answers: d.answers ? answeredMessage(d.answers) : null,
            replaced: d.replaced,
          },
          isError: false,
        };
      });
    },
  });

  const changeDraft = defineTool({
    name: "change_draft",
    description:
      "Change the text (reply) or the order (order draft) of a draft the owner asked to change. `owner_words` is what the owner said. A change voids any approval and puts the draft back to waiting.",
    input: { number: z.number().int().min(1), text: z.string().optional(), order: order.optional(), owner_words: z.string() },
    async run(a) {
      const input = {
        number: a.number,
        ownerWords: a.owner_words,
        ...(a.text === undefined ? {} : { text: a.text }),
        ...(a.order === undefined ? {} : { order: a.order }),
      };
      return outcome(u.changeDraft.run(input), (r) => ({
        text: `draft ${r.number} is ${r.state}${r.approvalVoided ? "; its approval was voided" : ""}`,
        structured: { ...r },
        isError: false,
      }));
    },
  });

  const rejectDraft = defineTool({
    name: "reject_draft",
    description: "Reject a draft the owner does not want. `owner_words` is what the owner said.",
    input: { number: z.number().int().min(1), owner_words: z.string() },
    async run(a) {
      return outcome(u.rejectDraft.run({ number: a.number, ownerWords: a.owner_words }), (r) => ({
        text: `draft ${r.number} is ${r.state}`,
        structured: { ...r },
        isError: false,
      }));
    },
  });

  return [createDraft, changeDraft, rejectDraft];
}

/** The owner's go. Offered only when a real sender is wired (see createApprovals). */
export function approvalTools(u: { approveDraft: ApproveDraft; approveOrderCommand: ApproveOrderCommand }): ToolDefinition[] {
  const approveDraft = defineTool({
    name: "approve_draft",
    description:
      "Send a draft, or record an order draft, after the owner's go. No go, no send: the owner's words must name the draft by its number. " +
      "If the owner's reply does not name the draft, ask again and name the drafts. One call per draft: there is no approve-all and no standing permission. " +
      "Show the owner the text from list_drafts first, and pass that exact text as `shown_text`.",
    input: { number: z.number().int().min(1), shown_text: z.string(), owner_words: z.string().min(1).max(1000) },
    async run(a) {
      return outcome(u.approveDraft.run({ number: a.number, shownText: a.shown_text, ownerWords: a.owner_words }), (r) => {
        // a failed or unknown outcome is an error result, so the agent cannot skip it as a success
        switch (r.outcome) {
          case "sent":
            return { text: `draft ${r.number} was sent`, structured: { ...r }, isError: false };
          case "recorded":
            return { text: `order draft ${r.number} was recorded as order ${r.orderId}`, structured: { ...r }, isError: false };
          case "failed":
            return { text: `draft ${r.number} failed: ${r.reason}; it needs a new go`, structured: { ...r }, isError: true };
          case "unknown":
            return { text: `draft ${r.number}: ${r.detail}`, structured: { ...r }, isError: true };
        }
      });
    },
  });

  const changeOrder = defineTool({
    name: "change_order",
    description:
      "Change fields of an existing order after the owner's words. Only the fields Orders accepts are allowed; anything else is refused. `owner_words` is what the owner said.",
    input: { order: z.string().min(1), change: z.record(z.string(), z.unknown()), owner_words: z.string() },
    async run(a) {
      return outcome(u.approveOrderCommand.run({ command: "change", orderRef: a.order, change: a.change, ownerWords: a.owner_words }), orderCommandResult);
    },
  });

  const deleteOrder = defineTool({
    name: "delete_order",
    description:
      "Delete an order after the owner's words. Call it first with `confirm` false to see what would be deleted; call again with `confirm` true once the owner agreed. `owner_words` is what the owner said.",
    input: { order: z.string().min(1), confirm: z.boolean(), owner_words: z.string() },
    async run(a) {
      return outcome(u.approveOrderCommand.run({ command: "delete", orderRef: a.order, confirm: a.confirm, ownerWords: a.owner_words }), orderCommandResult);
    },
  });

  return [approveDraft, changeOrder, deleteOrder];
}

/** One text field of a log entry: customer-derived (the draft text, the owner's words), so escaped and labeled, once per field. */
const labeled = (text: string | null): string | null => (text === null ? null : customerText("customer_text", text));

function describeEntry(e: LogEntryView): string {
  const lines = [`#${e.id} ${e.at} ${e.kind}${e.draft === null ? "" : ` draft ${e.draft}`} chat ${e.chat}${e.scrubbed ? " (scrubbed)" : ""}`];
  const fields: [string, string | null][] = [
    ["proposed", labeled(e.proposedText)],
    ["final", labeled(e.finalText)],
    ["owner words", labeled(e.ownerWords)],
    ["reason", e.reason],
  ];
  for (const [name, value] of fields) if (value !== null) lines.push(`  ${name}: ${value}`);
  return lines.join("\n");
}

/** Read-only: the log is a record, so no tool here changes or deletes an entry. */
export function logTools(u: { readDraftLog: ReadDraftLog; checkApprovals: CheckApprovals }): ToolDefinition[] {
  const draftsLog = defineTool({
    name: "drafts_log",
    description:
      "Read the drafts log, newest first: what was proposed, changed, approved, sent or rejected, with the owner's words. " +
      "Pass `chat` for one chat; when older entries exist, call again with `before`. The log is a record: nothing changes or deletes an entry.",
    input: {
      chat: z.string().min(1).optional(),
      limit: z.number().int().min(1).max(100).default(20),
      before: z.number().int().min(1).optional(),
    },
    async run(a) {
      return outcome(u.readDraftLog.run({ limit: a.limit, ...(a.chat === undefined ? {} : { chat: a.chat }), ...(a.before === undefined ? {} : { before: a.before }) }), (r) => {
        const lines =
          r.entries.length === 0
            ? [a.chat === undefined ? "nothing yet" : "no entries for this chat"]
            : r.entries.map(describeEntry);
        if (r.nextBefore !== null) lines.push(`older entries exist: call again with before = ${r.nextBefore}`);
        return {
          text: lines.join("\n"),
          structured: {
            entries: r.entries.map((e) => ({ ...e, proposedText: labeled(e.proposedText), finalText: labeled(e.finalText), ownerWords: labeled(e.ownerWords) })),
            nextBefore: r.nextBefore,
          },
          isError: false,
        };
      });
    },
  });

  const checkApprovals = defineTool({
    name: "check_approvals",
    description: "Check that every message that went out has its approval, and list drafts still in flight or of unknown outcome that have no sent entry.",
    input: {},
    async run() {
      const { defects, gaps } = await u.checkApprovals.run();
      if (defects.length === 0 && gaps.length === 0) {
        return { text: "every sent message has an approval", structured: { defects, gaps }, isError: false };
      }
      const lines = [
        ...defects.map((d) => `entry #${d.entryId} (draft ${d.draft ?? "none"}, chat ${d.chat}): ${d.problem}`),
        ...gaps.map((g) => `draft ${g.draft} (chat ${g.chat}) is ${g.state} with no sent entry since ${g.since}`),
      ];
      return { text: lines.join("\n"), structured: { defects, gaps }, isError: false };
    },
  });

  return [draftsLog, checkApprovals];
}

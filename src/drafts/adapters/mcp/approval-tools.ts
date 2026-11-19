import { z } from "zod";
import { defineTool, type ToolDefinition, type ToolResult } from "../../../adapters/mcp/tool";
import type { ApproveDraft, ApproveOrderCommand } from "../../ports/inbound";
import { outcome } from "./results";

type OrderCommandValue = Extract<Awaited<ReturnType<ApproveOrderCommand["run"]>>, { ok: true }>["value"];

function orderCommandResult(r: OrderCommandValue): ToolResult {
  if (!r.approved) return { text: r.pendingDelete, structured: { approved: false, pendingDelete: r.pendingDelete }, isError: false };
  return {
    text: r.result.ok ? r.result.detail : `Orders refused: ${r.result.reason}`,
    structured: { approved: true, logEntryId: r.logEntryId, result: r.result },
    isError: false,
  };
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
            return {
              text: r.logged
                ? `draft ${r.number} was sent`
                : `draft ${r.number} was sent, but its record could not be written yet; Deputy will keep trying, and check_approvals lists it until it is written`,
              structured: { ...r },
              isError: false,
            };
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

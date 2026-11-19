import { z } from "zod";
import { customerText } from "../../../adapters/mcp/customer-text";
import { defineTool, type ToolDefinition } from "../../../adapters/mcp/tool";
import type { ChangeDraft, CreateDraft, RejectDraft } from "../../ports/inbound";
import { answeredMessage, outcome, refusalResult } from "./results";

const order = z.record(z.string(), z.unknown());

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

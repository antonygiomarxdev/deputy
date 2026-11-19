import { customerText } from "../../../adapters/mcp/customer-text";
import type { ToolResult } from "../../../adapters/mcp/tool";
import type { Refusal } from "../../domain/refusals";
import { refusalText } from "../../domain/refusals";
import type { MessageView, Outcome } from "../../ports/inbound";

export function refusalResult(r: Refusal): ToolResult {
  const text = refusalText(r);
  return { text, structured: { ...r, refusalText: text }, isError: true };
}

/** The customer's message the draft answers: its text is customer-written, so it is escaped and labeled. */
export function answeredMessage(m: MessageView): { id: string; sentAt: string; source: string; text: string } {
  return { id: m.id, sentAt: m.sentAt, source: m.source, text: customerText("customer_text", m.text) };
}

export async function outcome<T>(run: Promise<Outcome<T>>, ok: (value: T) => ToolResult): Promise<ToolResult> {
  const out = await run;
  return out.ok ? ok(out.value) : refusalResult(out.refusal);
}

import { z } from "zod";
import { customerText } from "../../../adapters/mcp/customer-text";
import { defineTool, type ToolDefinition } from "../../../adapters/mcp/tool";
import type { CheckApprovals, LogEntryView, ReadDraftLog } from "../../ports/inbound";
import { outcome } from "./results";

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

import type { LeaseSupervisor } from "../adapters/supervisor/lease-supervisor";
import { formatSyncStatus, intakeTools } from "../intake/adapters/mcp/intake-tools";
import { approvalTools } from "../drafts/adapters/mcp/approval-tools";
import { draftsTools } from "../drafts/adapters/mcp/draft-tools";
import { logTools } from "../drafts/adapters/mcp/log-tools";
import { createApprovals, createDrafts } from "../drafts/index";
import type { GetOwnerNumbers, IntakeRuntime } from "../intake/index";
import { listDraftsTool } from "../composition/mcp/list-drafts-tool";
import { INSTRUCTIONS } from "../composition/mcp/instructions";
import { compositionTools } from "../composition/mcp/composition-tools";
import { createMcpServer } from "../composition/mcp/server";
import pkg from "../../package.json" with { type: "json" };

/** The MCP server and the tools it offers; the tool list is what the owner can ask for. */
export function mcpServer(d: {
  supervisor: Pick<LeaseSupervisor, "isOwner">;
  intake: IntakeRuntime;
  ownerNumbers: { getOwnerNumbers: GetOwnerNumbers };
  drafts: ReturnType<typeof createDrafts>;
  approvals: ReturnType<typeof createApprovals>;
}) {
  const { drafts, approvals, intake, supervisor, ownerNumbers } = d;
  return createMcpServer({
    name: "deputy",
    version: pkg.version,
    instructions: INSTRUCTIONS,
    tools: [
      ...compositionTools({
        isOwner: () => supervisor.isOwner,
        sections: [async () => formatSyncStatus(await intake.getSyncStatus.execute())],
      }),
      ...intakeTools({
        readChat: intake.readChat,
        listRejections: intake.listRejections,
        catchUp: intake.catchUp,
        getOwnerNumbers: ownerNumbers.getOwnerNumbers,
      }),
      ...draftsTools(drafts),
      ...logTools(drafts),
      // Orders is not wired yet, so change_order and delete_order would only ever refuse: only the go that sends is offered
      ...approvalTools(approvals).filter((t) => t.name === "approve_draft"),
      // Knowledge is not wired yet: no catalog is known, so every check is "unknown"
      listDraftsTool({ listDrafts: drafts.listDrafts, catalogChangedSince: async (since) => since.map(() => "unknown" as const) }),
    ],
    claudeChannel: false,
  });
}

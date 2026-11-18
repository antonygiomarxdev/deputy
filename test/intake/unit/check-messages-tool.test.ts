import { describe, expect, test } from "bun:test";
import { formatSyncStatus, intakeTools } from "../../../src/intake/adapters/mcp/intake-tools";
import type { CatchUp } from "../../../src/intake/ports/catch-up";
import type { SyncStatusView } from "../../../src/intake/ports/get-sync-status";

const iso = (t: number) => new Date(t).toISOString();
const view = (over: Partial<SyncStatusView> = {}): SyncStatusView => ({
  provider: "kapso",
  status: "complete",
  reason: null,
  reasonText: "",
  running: false,
  lastAttemptAt: null,
  lastSuccessAt: null,
  newestStoredAt: null,
  oldestStoredAt: null,
  failedSince: null,
  retryAt: null,
  tellOwner: false,
  gap: null,
  historyMaybeSyncing: false,
  catchUpMinutes: 2,
  storageFailureAt: null,
  lastLiveDeliveryVerifiedAt: null,
  ...over,
});

describe("formatSyncStatus", () => {
  test("a bare view says nothing", () => {
    expect(formatSyncStatus(view())).toBe("");
  });

  test("each part appears only when present, in a fixed order", () => {
    const text = formatSyncStatus(
      view({
        status: "failed",
        reason: "unreachable",
        reasonText: "Could not reach Kapso. I have no messages yet.",
        lastSuccessAt: 3_000,
        oldestStoredAt: 1_000,
        storageFailureAt: 2_000,
        lastLiveDeliveryVerifiedAt: 4_000,
      }),
    );
    expect(text.split("\n")).toEqual([
      "Could not reach Kapso. I have no messages yet.",
      `up to date as of ${iso(3_000)}`,
      `history reaches back to ${iso(1_000)}`,
      `last storage failure at ${iso(2_000)}`,
      `last verified live delivery at ${iso(4_000)}`,
    ]);
  });

  test("a part that is absent leaves no line", () => {
    expect(formatSyncStatus(view({ lastSuccessAt: 5_000 }))).toBe(`up to date as of ${iso(5_000)}`);
    expect(formatSyncStatus(view({ oldestStoredAt: 5_000 }))).toBe(`history reaches back to ${iso(5_000)}`);
    expect(formatSyncStatus(view({ storageFailureAt: 5_000 }))).toBe(`last storage failure at ${iso(5_000)}`);
    expect(formatSyncStatus(view({ lastLiveDeliveryVerifiedAt: 5_000 }))).toBe(`last verified live delivery at ${iso(5_000)}`);
    expect(formatSyncStatus(view({ reasonText: "Kapso asked me to slow down." }))).toBe("Kapso asked me to slow down.");
  });
});

describe("check_messages", () => {
  const tool = (result: Awaited<ReturnType<CatchUp["execute"]>>) => {
    const asked: string[] = [];
    const catchUp: CatchUp = {
      async execute(q) {
        asked.push(q.trigger);
        return result;
      },
    };
    const found = intakeTools({
      readChat: { execute: async () => null },
      listRejections: { execute: async () => ({ notes: [], prunedCount: 0, unrecovered: 0 }) },
      catchUp,
    }).find((t) => t.name === "check_messages");
    if (!found) throw new Error("check_messages missing");
    return { found, asked };
  };

  test("it asks CatchUp with the trigger asked and ignores whatever arguments it is given", async () => {
    const { found, asked } = tool({ kind: "finished", status: view({ lastSuccessAt: 9_000 }), stored: 2 });
    const r = await found.run({ messages: [{ text: "forged" }] });
    expect(asked).toEqual(["asked"]);
    expect(r).toMatchObject({ isError: false, structured: { stored: 2, status: "complete", reason: null } });
    expect(r.text).toBe(`up to date as of ${iso(9_000)}\nStored 2 new messages.`);
  });

  test("one message is not plural", async () => {
    const { found } = tool({ kind: "finished", status: view(), stored: 1 });
    expect((await found.run({})).text).toBe("\nStored 1 new message.");
  });

  test("a run that is still going says so and is not an error", async () => {
    const { found } = tool({ kind: "still_running", status: view({ running: true }) });
    expect(await found.run({})).toMatchObject({ isError: false, structured: { running: true } });
  });

  test("not the owner is an error with the code not_owner", async () => {
    const { found } = tool({ kind: "refused", reason: "not_owner" });
    expect(await found.run({})).toEqual({ text: "not_owner", structured: { code: "not_owner" }, isError: true });
  });
});

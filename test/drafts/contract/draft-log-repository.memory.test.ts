import { expect, test } from "bun:test";
import { InMemoryDrafts } from "../../../src/drafts/adapters/memory/in-memory-drafts";
import { Draft } from "../../../src/drafts/domain/draft";
import { toIso } from "../../../src/drafts/domain/time";
import { draftLogRepositoryContract, entry } from "./draft-log-repository.contract";
import { newDraft } from "./draft-repository.contract";
import type { ChatId } from "../../../src/shared/chat-id";

const owner = { isOwner: async () => true };

draftLogRepositoryContract("in memory", () => new InMemoryDrafts(owner).log);

test("stuckDrafts lists reply drafts in sending or unknown with no sent entry, since the latest sending entry", async () => {
  const store = new InMemoryDrafts(owner);
  const states = ["sending", "unknown", "sending", "waiting"] as const;
  for (const [i, state] of states.entries()) {
    const d = Draft.rehydrate({ ...newDraft(i + 1, "reply", `c${i}` as ChatId).snapshot(), state });
    await store.unitOfWork.run((tx) => tx.drafts.save(d));
  }
  await store.log.append([
    entry({ kind: "sending", draft: 1, at: 100 }),
    entry({ kind: "sending", draft: 1, at: 300 }),
    entry({ kind: "sending", draft: 3, at: 200 }),
    entry({ kind: "sent", draft: 3, at: 250 }),
  ]);
  expect(await store.log.stuckDrafts()).toEqual([
    { draft: 1, chat: "c0", state: "sending", since: toIso(300) },
    { draft: 2, chat: "c1", state: "unknown", since: toIso(1_000) },
  ]);
});

import { describe, expect, test } from "bun:test";
import { Draft } from "../../../src/drafts/domain/draft";
import { LogUnavailable } from "../../../src/drafts/domain/errors";
import type { DraftLogRepository } from "../../../src/drafts/ports/log";
import { FakeClock } from "../../support/fake-clock";
import { makeDrafts, message } from "./harness";

const chats = { "chat-a": [message("a1", "customer", "How much?", 900)] };

/** A log whose `sent` append fails `remaining` times, then works. */
function scripted(fail: { remaining: number }) {
  return (log: DraftLogRepository): DraftLogRepository => ({
    append: async (entries) => {
      if (entries.some((e) => e.kind === "sent") && fail.remaining > 0) {
        fail.remaining--;
        throw new LogUnavailable();
      }
      return log.append(entries);
    },
    page: (f) => log.page(f),
    sentWithApproval: () => log.sentWithApproval(),
    stuckDrafts: () => log.stuckDrafts(),
    scrubOrder: (o, d) => log.scrubOrder(o, d),
    approvalEntryIdFor: (s) => log.approvalEntryIdFor(s),
    hasOrderDeleted: (o) => log.hasOrderDeleted(o),
  });
}

function setup(failures: number) {
  const fail = { remaining: failures };
  const clock = new FakeClock(1_000);
  const h = makeDrafts({
    chats,
    clock,
    unitOfWork: (store) => ({
      read: (work) => store.unitOfWork.read(work),
      run: (work, o) => store.unitOfWork.run((tx) => work({ ...tx, log: scripted(fail)(tx.log) }), o),
    }),
  });
  return { h, fail, clock };
}

/** Lets the approve call run while the fake clock is moved past each of its waits. */
async function settle<T>(p: Promise<T>, clock: FakeClock): Promise<T> {
  let done = false;
  void p.finally(() => {
    done = true;
  });
  while (!done) {
    await new Promise((r) => setTimeout(r, 0));
    await clock.advance(1_000);
  }
  return p;
}

async function approve(h: ReturnType<typeof setup>["h"], clock: FakeClock) {
  await h.createDraft.run({ kind: "reply", chat: "chat-a", text: "ten" });
  await h.listDrafts.run({});
  return settle(h.approveDraft.run({ number: 1, shownText: "ten", ownerWords: "go 1" }), clock);
}

const draftOf = async (h: ReturnType<typeof setup>["h"]) => (await h.store.unitOfWork.run((tx) => tx.drafts.get(1), { requireLease: false }))?.snapshot();

describe("FR-DRAFTS-04-5: a sent entry that cannot be written", () => {
  test("three failures: the owner is told it went out and the record is missing; one send; the draft is a gap", async () => {
    const { h, clock } = setup(3);
    const out = await approve(h, clock);
    expect(out).toEqual({ ok: true, value: { outcome: "sent", number: 1, sendId: "deputy:ap1", logged: false } });
    expect(h.sender.calls).toHaveLength(1);
    expect((await draftOf(h))?.state).toBe("sending");
    expect((await h.checkApprovals.run()).gaps).toEqual([{ draft: 1, chat: "chat-a", state: "sending", since: new Date(1_000).toISOString() }]);
    expect(h.pending.list()).toEqual([{ draft: 1, sendId: "deputy:ap1", approvalEntryId: expect.any(Number) }]);
  });

  test("the retries wait 1 second, then 2 more", async () => {
    const { h, clock } = setup(3);
    await h.createDraft.run({ kind: "reply", chat: "chat-a", text: "ten" });
    await h.listDrafts.run({});
    const run = h.approveDraft.run({ number: 1, shownText: "ten", ownerWords: "go 1" });
    let done = false;
    void run.finally(() => (done = true));
    const pause = () => new Promise((r) => setTimeout(r, 5));
    await pause();
    await clock.advance(999);
    await pause();
    expect(done).toBe(false);
    await clock.advance(1); // 1 second: the second try fails
    await pause();
    await clock.advance(1_999);
    await pause();
    expect(done).toBe(false);
    await clock.advance(1); // 3 seconds in all: the third try fails
    await run;
    expect(done).toBe(true);
    expect(h.sender.calls).toHaveLength(1);
  });

  test("the first write fails and the second works: logged is true after one retry", async () => {
    const { h, clock } = setup(1);
    expect(await approve(h, clock)).toEqual({ ok: true, value: { outcome: "sent", number: 1, sendId: "deputy:ap1", logged: true } });
    expect((await draftOf(h))?.state).toBe("sent");
    expect(h.pending.list()).toEqual([]);
  });

  test("the retry on the owner's tick: while the write fails pending stays 1 and nothing is sent again; once it works the record is written", async () => {
    const { h, fail, clock } = setup(3);
    await approve(h, clock);
    fail.remaining = 1; // still failing at the next tick
    await clock.advance(10_000);
    expect(await h.retryPendingOutcomes.run()).toEqual({ written: 0, pending: 1 });
    expect(h.sender.calls).toHaveLength(1);
    await clock.advance(10_000);
    expect(await h.retryPendingOutcomes.run()).toEqual({ written: 1, pending: 0 });
    expect((await draftOf(h))?.state).toBe("sent");
    const log = await h.store.log.page({ after: 0, limit: 50 });
    expect(log.find((e) => e.kind === "sent")).toMatchObject({ draft: 1, finalText: "ten", sendId: "deputy:ap1", approvalEntryId: log.find((e) => e.kind === "approved")?.id });
    expect((await h.checkApprovals.run()).gaps).toEqual([]);
    expect(h.sender.calls).toHaveLength(1);
  });

  test("a tick without the lease keeps the item; a draft that is no longer sending drops it", async () => {
    const { h, clock } = setup(3);
    await approve(h, clock);
    h.holder.token = "other";
    expect(await h.retryPendingOutcomes.run()).toEqual({ written: 0, pending: 1 });
    h.holder.token = "me";
    await h.store.unitOfWork.run(async (tx) => {
      const d = await tx.drafts.get(1);
      if (d) await tx.drafts.save(Draft.rehydrate({ ...d.snapshot(), state: "sent" }));
    });
    expect(await h.retryPendingOutcomes.run()).toEqual({ written: 0, pending: 0 });
    expect(h.sender.calls).toHaveLength(1);
  });

  test("a tick that comes while the previous run is still in flight is skipped, not overlapped", async () => {
    const { h, fail, clock } = setup(3);
    await approve(h, clock);
    fail.remaining = 0;
    let appends = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const original = h.store.unitOfWork.run.bind(h.store.unitOfWork);
    // hold the first retry inside its transaction
    h.store.unitOfWork.run = async (work, o) => {
      appends++;
      await gate;
      return original(work, o);
    };
    const first = h.retryPendingOutcomes.run();
    await new Promise((r) => setTimeout(r, 5));
    expect(await h.retryPendingOutcomes.run()).toEqual({ written: 0, pending: 1 });
    expect(appends).toBe(1);
    release();
    expect(await first).toEqual({ written: 1, pending: 0 });
    expect(await h.retryPendingOutcomes.run()).toEqual({ written: 0, pending: 0 });
  });

  test("a failed write of a result other than sent is log_unavailable and leaves the draft sending", async () => {
    const fail = { remaining: 0 };
    let breakUnknown = false;
    const h = makeDrafts({
      chats,
      unitOfWork: (store) => ({
        read: (work) => store.unitOfWork.read(work),
        run: (work, o) =>
          store.unitOfWork.run(
            (tx) =>
              work({
                ...tx,
                log: breakUnknown
                  ? { ...scripted(fail)(tx.log), append: async (e) => (e.some((x) => x.kind === "unknown") ? Promise.reject(new LogUnavailable()) : tx.log.append(e)) }
                  : tx.log,
              }),
            o,
          ),
      }),
    });
    await h.createDraft.run({ kind: "reply", chat: "chat-a", text: "ten" });
    await h.listDrafts.run({});
    h.sender.result = { kind: "unknown", partsSent: 1, partsTotal: 2 };
    breakUnknown = true;
    expect(await h.approveDraft.run({ number: 1, shownText: "ten", ownerWords: "go 1" })).toEqual({ ok: false, refusal: { code: "log_unavailable" } });
    expect((await draftOf(h))?.state).toBe("sending");
    expect(h.pending.list()).toEqual([]);
  });
});

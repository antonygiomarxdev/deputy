import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { SyncState } from "../../../src/intake/domain/sync-state";
import { subjects, type IntakeSubject } from "../../support/intake-subjects";

function fullState(): SyncState {
  const s = SyncState.initial("kapso");
  s.begin({ providerTime: 1_000, now: 2_000 });
  s.advanceConversations(900);
  s.saveOutboundResume({ cursor: "abc", from: 700, runStart: 2_000 });
  s.completeOutbound(950);
  s.saveOutboundResume({ cursor: "next", from: null, runStart: 3_000 });
  s.countStored(7);
  s.setGap({ storedAt: 10, returnedAt: 20 });
  s.fail("possible_gap", 4_000);
  return s;
}

for (const subject of subjects) {
  describe(`SyncStateRepository (${subject.name})`, () => {
    let s: IntakeSubject;
    beforeEach(async () => {
      s = await subject.open();
    });
    afterEach(() => s.cleanup());

    test("FR-INTAKE-03-6: a saved state loads with every field; an unknown provider is null", async () => {
      const state = fullState();
      await s.repos.syncState.save(state);
      expect((await s.repos.syncState.load("kapso"))?.props).toEqual(state.props);
      expect(await s.repos.syncState.load("dev")).toBeNull();
    });

    test("a stale state never moves a mark back and connectedAt keeps the first value", async () => {
      const fresh = SyncState.initial("kapso");
      fresh.begin({ providerTime: 100, now: 1 });
      fresh.advanceConversations(100);
      fresh.completeOutbound(80);
      await s.repos.syncState.save(fresh);
      const stale = SyncState.initial("kapso");
      stale.begin({ providerTime: 999, now: 2 });
      stale.advanceConversations(50);
      stale.completeOutbound(60);
      await s.repos.syncState.save(stale);
      const back = (await s.repos.syncState.load("kapso"))?.props;
      expect(back).toMatchObject({ markConversations: 100, markOutbound: 80, connectedAt: 100 });
    });

    test("save never overwrites liveVerifiedAt", async () => {
      await s.repos.syncState.markLiveVerified("kapso", 555);
      await s.repos.syncState.save(SyncState.rehydrate({ ...fullState().props, liveVerifiedAt: 1 }));
      expect(await s.repos.syncState.liveVerifiedAt("kapso")).toBe(555);
      expect((await s.repos.syncState.load("kapso"))?.props.liveVerifiedAt).toBe(555);
    });

    test("a row made by markLiveVerified alone loads as not yet run", async () => {
      await s.repos.syncState.markLiveVerified("kapso", 10);
      const loaded = await s.repos.syncState.load("kapso");
      expect(loaded?.isNotYetRun()).toBe(true);
      expect(loaded?.props.liveVerifiedAt).toBe(10);
    });

    test("each provider has its own row and its own connectedAt", async () => {
      const kapso = SyncState.initial("kapso");
      kapso.begin({ providerTime: 100, now: 1 });
      const dev = SyncState.initial("dev");
      dev.begin({ providerTime: 200, now: 1 });
      await s.repos.syncState.save(kapso);
      await s.repos.syncState.save(dev);
      expect(await s.repos.syncState.connectedAt("kapso")).toBe(100);
      expect(await s.repos.syncState.connectedAt("dev")).toBe(200);
    });
  });
}

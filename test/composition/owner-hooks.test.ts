import { describe, expect, test } from "bun:test";
import { ownerHooks } from "../../src/composition/owner-hooks";

function setup(listens: boolean) {
  const log: string[] = [];
  const events: string[] = [];
  const hooks = ownerHooks({
    listener: {
      start: async () => void events.push("listener.start"),
      stop: async () => void events.push("listener.stop"),
    },
    listens,
    scheduler: { start: () => void events.push("scheduler.start"), stop: () => void events.push("scheduler.stop") },
    ownerLine: "deputy: owner of here",
    log: (line) => log.push(line),
  });
  return { hooks, events, log };
}

describe("ownerHooks", () => {
  test("becoming the owner starts the listener when the provider listens, then the scheduler, then says so", async () => {
    const { hooks, events, log } = setup(true);
    await hooks.onAcquired();
    expect(events).toEqual(["listener.start", "scheduler.start"]);
    expect(log).toEqual(["deputy: owner of here"]);
  });

  test("a provider that does not listen starts no listener but still the scheduler", async () => {
    const { hooks, events } = setup(false);
    await hooks.onAcquired();
    expect(events).toEqual(["scheduler.start"]);
  });

  test("losing the lease stops the scheduler and the listener and says so", async () => {
    const { hooks, events, log } = setup(true);
    await hooks.onLost();
    expect(events).toEqual(["scheduler.stop", "listener.stop"]);
    expect(log).toEqual(["deputy: lost the owner lease"]);
  });
});

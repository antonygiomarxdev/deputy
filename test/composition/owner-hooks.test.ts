import { describe, expect, test } from "bun:test";
import { ownerHooks } from "../../src/composition/owner-hooks";

function setup(listens: boolean, marked = 0) {
  const log: string[] = [];
  const events: string[] = [];
  const hooks = ownerHooks({
    markInterruptedSends: async () => {
      events.push("markInterruptedSends");
      return { marked };
    },
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
    expect(events).toEqual(["markInterruptedSends", "listener.start", "scheduler.start"]);
    expect(log).toEqual(["deputy: owner of here"]);
  });

  test("a provider that does not listen starts no listener but still the scheduler", async () => {
    const { hooks, events } = setup(false);
    await hooks.onAcquired();
    expect(events).toEqual(["markInterruptedSends", "scheduler.start"]);
  });

  test("interrupted sends are marked before the listener and the scheduler start, and reported when there are some", async () => {
    const { hooks, events, log } = setup(true, 2);
    await hooks.onAcquired();
    expect(events.indexOf("markInterruptedSends")).toBe(0);
    expect(log).toEqual(["deputy: 2 interrupted send(s) are now unknown", "deputy: owner of here"]);
    const quiet = setup(true, 0);
    await quiet.hooks.onAcquired();
    expect(quiet.log).toEqual(["deputy: owner of here"]);
  });

  test("losing the lease stops the scheduler and the listener and says so", async () => {
    const { hooks, events, log } = setup(true);
    await hooks.onLost();
    expect(events).toEqual(["scheduler.stop", "listener.stop"]);
    expect(log).toEqual(["deputy: lost the owner lease"]);
  });
});

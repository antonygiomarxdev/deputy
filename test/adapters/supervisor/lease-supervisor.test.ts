import { expect, spyOn, test } from "bun:test";
import { LeaseSupervisor } from "../../../src/adapters/supervisor/lease-supervisor";
import { FakeClock } from "../../support/fake-clock";
import { InMemoryOwnerLease, type LeaseHolder } from "../../support/in-memory-owner-lease";

const tick = () => new Promise((r) => setTimeout(r, 0));

function setup() {
  const clock = new FakeClock(1_000_000);
  const holder: LeaseHolder = { token: null, heartbeat: 0 };
  const make = (token: string, hooks: { onAcquired?: () => Promise<void> } = {}) => {
    const calls = { acquired: 0, lost: 0 };
    const s = new LeaseSupervisor({
      lease: new InMemoryOwnerLease(holder, clock, token),
      clock,
      onAcquired: async () => {
        calls.acquired++;
        await hooks.onAcquired?.();
      },
      onLost: async () => {
        calls.lost++;
      },
    });
    return { s, calls };
  };
  return { clock, holder, make };
}

test("a free lease: onAcquired runs once", async () => {
  const { clock, make } = setup();
  const a = make("a");
  a.s.start();
  await tick();
  await clock.advance(35_000);
  expect(a.calls.acquired).toBe(1);
  expect(a.s.isOwner).toBe(true);
  await a.s.stop();
});

test("the owner stops renewing for 30 s: the second takes over and the first gets onLost", async () => {
  const { clock, holder, make } = setup();
  const a = make("a");
  a.s.start();
  await tick();
  expect(a.calls.acquired).toBe(1);
  // a stalls: its heartbeat stays where it is while time passes
  const stalledAt = holder.heartbeat;
  await clock.advance(31_000);
  holder.heartbeat = stalledAt;
  const b = make("b");
  b.s.start();
  await tick();
  expect(b.calls.acquired).toBe(1);
  await clock.advance(10_000);
  expect(a.calls.lost).toBe(1);
  expect(a.s.isOwner).toBe(false);
  await a.s.stop();
  await b.s.stop();
});

test("a throwing onAcquired is logged and tried again at the next tick", async () => {
  const { clock, make } = setup();
  const log = spyOn(console, "error").mockImplementation(() => {});
  let first = true;
  const a = make("a", {
    onAcquired: async () => {
      if (first) {
        first = false;
        throw new Error("boom");
      }
    },
  });
  a.s.start();
  await tick();
  expect(a.s.isOwner).toBe(false);
  expect(log).toHaveBeenCalled();
  await clock.advance(10_000);
  await tick();
  expect(a.calls.acquired).toBe(2);
  expect(a.s.isOwner).toBe(true);
  log.mockRestore();
  await a.s.stop();
});

test("a 45 s onAcquired keeps renewing, so the second never acquires", async () => {
  const { clock, make } = setup();
  let finish: () => void = () => {};
  const a = make("a", { onAcquired: () => new Promise<void>((r) => (finish = r)) });
  a.s.start();
  await tick();
  const b = make("b");
  b.s.start();
  await tick();
  for (const t of [10_000, 10_000, 10_000, 10_000]) {
    await clock.advance(t);
    await tick();
  }
  expect(b.calls.acquired).toBe(0);
  expect(a.s.isOwner).toBe(false);
  await clock.advance(5_000);
  finish();
  await tick();
  expect(a.s.isOwner).toBe(true);
  expect(b.calls.acquired).toBe(0);
  await a.s.stop();
  await b.s.stop();
});

test("stop calls onLost when owner and releases the lease", async () => {
  const { holder, make } = setup();
  const a = make("a");
  a.s.start();
  await tick();
  await a.s.stop();
  expect(a.calls.lost).toBe(1);
  expect(holder.heartbeat).toBe(0);
});

test("stop does not wait for a running onAcquired and leaves the lease free", async () => {
  const { holder, make } = setup();
  const a = make("a", { onAcquired: () => new Promise<void>(() => {}) });
  a.s.start();
  await tick();
  const t0 = performance.now();
  await a.s.stop();
  expect(performance.now() - t0).toBeLessThan(400);
  expect(holder.heartbeat).toBe(0);
});

test("a lease taken over while onAcquired ran: not owner, and what it started is stopped", async () => {
  const { holder, make } = setup();
  const a = make("a", {
    onAcquired: async () => {
      holder.token = "b";
    },
  });
  a.s.start();
  await tick();
  expect(a.s.isOwner).toBe(false);
  expect(a.calls.lost).toBe(1);
  await a.s.stop();
});

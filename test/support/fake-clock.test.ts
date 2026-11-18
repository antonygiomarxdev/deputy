import { expect, test } from "bun:test";
import { FakeClock } from "./fake-clock";

test("autoAdvance jumps to the earliest sleeper once everything else is idle", async () => {
  const clock = new FakeClock(100);
  clock.autoAdvance();
  const order: string[] = [];
  const slow = clock.sleep(5_000).then(() => order.push("slow"));
  const fast = clock.sleep(1_000).then(() => order.push("fast"));
  await Promise.all([slow, fast]);
  expect(order).toEqual(["fast", "slow"]);
  expect(clock.now()).toBe(5_100);
});

test("without autoAdvance a sleeper waits for advance", async () => {
  const clock = new FakeClock(0);
  let done = false;
  void clock.sleep(10).then(() => (done = true));
  await new Promise((r) => setTimeout(r, 5));
  expect(done).toBe(false);
  await clock.advance(10);
  expect(done).toBe(true);
});

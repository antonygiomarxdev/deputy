import { describe, expect, test } from "bun:test";
import { Pacer } from "../../../src/intake/adapters/kapso/pacer";
import { FakeClock } from "../../support/fake-clock";

const MIN = 60_000;
const BASE = 1_000 * MIN;

function setup() {
  const clock = new FakeClock(BASE + 10_000);
  clock.autoAdvance();
  return { clock, pacer: new Pacer(clock) };
}

describe("Pacer", () => {
  test("before any answer a read does not wait", async () => {
    const { clock, pacer } = setup();
    const at = clock.now();
    await pacer.beforeRead();
    expect(clock.now()).toBe(at);
  });

  test("an answer without a remaining count never makes a read wait", async () => {
    const { clock, pacer } = setup();
    pacer.observe({ remaining: null, serverTime: clock.now() });
    const at = clock.now();
    await pacer.beforeRead();
    expect(clock.now()).toBe(at);
  });

  test("a remaining count of 10 or more does not wait; below 10 waits for the next provider minute plus 1 s", async () => {
    const { clock, pacer } = setup();
    pacer.observe({ remaining: 10, serverTime: clock.now() });
    await pacer.beforeRead();
    expect(clock.now()).toBe(BASE + 10_000);
    pacer.observe({ remaining: 9, serverTime: clock.now() });
    await pacer.beforeRead();
    expect(clock.now()).toBe(BASE + MIN + 1_000);
  });

  test("the provider clock is read from the answer, not from the local one", async () => {
    const { clock, pacer } = setup();
    // the provider is 30 s ahead of the local clock: its minute ends 30 s sooner
    pacer.observe({ remaining: 3, serverTime: BASE + 40_000 });
    await pacer.beforeRead();
    expect(clock.now()).toBe(BASE + 10_000 + 21_000);
  });
});
